"""Opt-in, single-request smoke test; importing or preflighting makes no HTTP calls.

Run ``python -m policyforge.nebius_smoke`` for local preflight only.
The explicit ``--execute-one-request`` flag is required for paid inference.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import dataclass, field
import json
import logging
import os
import re
from threading import Lock
from typing import Any, Iterator
from urllib.parse import quote, urlsplit

import httpx
import openai
from openai.types.chat import ChatCompletionMessageParam
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from policyforge.compiler import PolicyCompiler, split_document_into_clauses
from policyforge.llm import LLMCallRecord, LLMClient
from policyforge.models import Rule

POLICY_TEXT = "Customers may request a refund within 30 days of delivery."
DOC_NAME = "synthetic_refund.md"
MAX_OUTPUT_TOKENS = 512
TIMEOUT_SECONDS = 30.0
MAX_PROVIDER_REQUESTS = 1
ALLOWED_HOSTS = frozenset({
    "api.tokenfactory.nebius.com", "api.tokenfactory.nebius.ai",
    "api.studio.nebius.ai", "api.tokenfactory.us-central1.nebius.com",
})


class SmokeGuardError(RuntimeError):
    """A fixed-message local safety failure; never embeds request details."""


@dataclass(frozen=True)
class SmokeConfiguration:
    model: str
    base_url: str
    api_key: SecretStr = field(repr=False)

    def __post_init__(self) -> None:
        if not self.api_key.get_secret_value().strip():
            raise SmokeGuardError("NEBIUS_API_KEY is missing or empty.")
        if not re.fullmatch(r"nvidia/[A-Za-z0-9_.-]+", self.model) or "nemotron" not in self.model.lower():
            raise SmokeGuardError("Configure an explicit NVIDIA Nemotron model.")
        url = urlsplit(self.base_url)
        if (url.scheme != "https" or url.hostname not in ALLOWED_HOSTS
                or url.port not in (None, 443) or url.path.rstrip("/") != "/v1"
                or url.username or url.password or url.query or url.fragment):
            raise SmokeGuardError("Configure an approved HTTPS Nebius /v1 endpoint.")


def read_configuration() -> SmokeConfiguration:
    """The existing LLM module loads root .env; no OpenAI credential fallback here."""
    return SmokeConfiguration(
        model=os.getenv("NEBIUS_MODEL", "").strip(),
        base_url=os.getenv("NEBIUS_BASE_URL", "").strip(),
        api_key=SecretStr(os.getenv("NEBIUS_API_KEY", "")),
    )


class OneRequestTransport(httpx.BaseTransport):
    """Consume the only attempt before sending, including failed/timeout attempts."""

    def __init__(self, endpoint: str, inner: httpx.BaseTransport) -> None:
        self._endpoint = httpx.URL(endpoint.rstrip("/") + "/chat/completions")
        self._inner = inner
        self._lock = Lock()
        self.attempts = 0

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        with self._lock:
            if request.method != "POST" or request.url != self._endpoint:
                raise SmokeGuardError("Only the configured inference endpoint is allowed.")
            if self.attempts >= MAX_PROVIDER_REQUESTS:
                raise SmokeGuardError("The single provider request budget is exhausted.")
            self.attempts += 1
        return self._inner.handle_request(request)

    def close(self) -> None:
        self._inner.close()


class SmokeEnvelope(BaseModel):
    """One synthetic clause must yield exactly one existing Pydantic IR Rule."""

    model_config = ConfigDict(extra="forbid")
    rules: list[Rule] = Field(min_length=1, max_length=1)


class SingleRequestClient(LLMClient):
    """Narrow LLMClient adapter; the general wrapper and its retry loop are unused."""

    def __init__(self, configuration: SmokeConfiguration, transport: OneRequestTransport) -> None:
        # Do not construct the general client: this adapter owns its guarded HTTP
        # transport, token cap and telemetry without changing shared client behavior.
        self.model = configuration.model
        self.timeout = TIMEOUT_SECONDS
        self.max_retries = 0
        self.call_history: list[LLMCallRecord] = []
        self._used = False
        self._lock = Lock()
        self.usage: dict[str, int] | None = None
        self.finish_reason: str | None = None
        self._transport = transport
        self._http = httpx.Client(
            transport=transport, timeout=TIMEOUT_SECONDS,
            follow_redirects=False, trust_env=False,
        )
        self._client = openai.OpenAI(
            api_key=configuration.api_key.get_secret_value(),
            base_url=configuration.base_url, max_retries=0,
            timeout=TIMEOUT_SECONDS, http_client=self._http,
        )

    def chat_complete(
        self, messages: list[dict[str, str]], temperature: float = 0.0,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        with self._lock:
            if self._used:
                raise SmokeGuardError("A second model invocation is forbidden.")
            self._used = True
        if (response_format != {"type": "json_object"} or temperature != 0.0
                or len(messages) != 2 or messages[0].get("role") != "system"
                or messages[1].get("role") != "user"):
            raise SmokeGuardError("Only the fixed JSON extraction operation is allowed.")
        instruction = messages[0]["content"] + (
            "\nReturn exactly one compact rule. Required fields: id (string), name "
            "(string), decision, trigger, when, effect, source. Optional defaults: "
            "priority=0, overrides=[], state_updates=null. Copy source.doc_name "
            "from the input. No reasoning, prose, or extra fields."
        )
        prompt: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": instruction},
            {"role": "user", "content": messages[1]["content"]},
        ]
        assert self._client is not None
        response = self._client.chat.completions.create(
            model=self.model, messages=prompt, temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=MAX_OUTPUT_TOKENS, n=1, stream=False,
        )
        if response.usage is not None:
            self.usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
        if len(response.choices) != 1:
            raise SmokeGuardError("The provider did not return exactly one completion.")
        choice = response.choices[0]
        self.finish_reason = choice.finish_reason
        if choice.finish_reason != "stop" or choice.message.refusal:
            raise SmokeGuardError("The completion was truncated, refused, or incomplete; no retry.")
        # Local validation only. Invalid JSON/schema output ends this run here.
        envelope = SmokeEnvelope.model_validate_json(choice.message.content or "")
        return envelope.model_dump_json()

    def get_total_usage(self) -> dict[str, Any]:
        return {"call_count": self._transport.attempts, "provider_usage": self.usage}

    def close(self) -> None:
        if self._client is not None:
            self._client.close()


@contextmanager
def quiet_provider_logs() -> Iterator[None]:
    """Suppress SDK/HTTP debug logs during this synchronous CLI operation only."""
    previous = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        yield
    finally:
        logging.disable(previous)


def _redacted(data: dict[str, Any], secret: SecretStr) -> dict[str, Any]:
    """Defense in depth for unexpected key echoes inside provider-generated IR."""
    value = secret.get_secret_value()
    text = json.dumps(data, ensure_ascii=True)
    for form in (json.dumps(value)[1:-1], value, quote(value, safe="")):
        if form:
            text = text.replace(form, "[REDACTED]")
    return json.loads(text)


def run_smoke(
    *, execute: bool = False, configuration: SmokeConfiguration | None = None,
    offline_transport: httpx.MockTransport | None = None,
) -> dict[str, Any]:
    """One invocation, at most one POST; default execution is local preflight only.

    Tests must supply MockTransport. There is no API/frontend/background hook.
    Running the CLI again is a separate explicit operation, not a retry.
    """
    config: SmokeConfiguration | None = configuration
    report: dict[str, Any] = {
        "status": "prepared_live_disabled", "validation": "not_run",
        "max_output_tokens": MAX_OUTPUT_TOKENS, "timeout_seconds": TIMEOUT_SECONDS,
        "sdk_retries": 0, "wrapper_retries": 0, "compiler_repairs": 0,
        "max_provider_requests": MAX_PROVIDER_REQUESTS, "provider_requests": 0,
        "token_usage": None, "validated_rules": [], "errors": [],
    }
    client: SingleRequestClient | None = None
    guard: OneRequestTransport | None = None
    try:
        config = config or read_configuration()
        report.update(model=config.model, configuration="configured", api_key_configured=True)
        if len(split_document_into_clauses(POLICY_TEXT, DOC_NAME)) != 1:
            raise SmokeGuardError("The synthetic input must contain exactly one clause.")
        if not execute:
            return _redacted(report, config.api_key)
        with quiet_provider_logs():
            inner = offline_transport if offline_transport is not None else httpx.HTTPTransport(retries=0)
            guard = OneRequestTransport(config.base_url, inner)
            client = SingleRequestClient(config, guard)
            compiler = PolicyCompiler(llm_client=client, max_repairs=0)
            compiled = compiler.compile_document(POLICY_TEXT, DOC_NAME)
            if compiled.rejected_rules or compiled.unmapped_clauses or len(compiled.compiled_rules) != 1:
                report.update(status="failed", validation="failed")
                report["errors"] = [{"type": "compiler_rejection", "message": "Local compiler grounding or clause validation failed; no retry."}]
            else:
                report.update(status="succeeded", validation="passed")
                report["validated_rules"] = [rule.model_dump(mode="json") for rule in compiled.compiled_rules]
            report["lint_warnings"] = compiled.lint_warnings
    except ValidationError as exc:
        report.update(status="failed", validation="failed")
        report["errors"] = exc.errors(include_input=False, include_context=False, include_url=False)
    except SmokeGuardError as exc:
        report.update(status="failed")
        report["errors"] = [{"type": "guard", "message": str(exc)}]
    except openai.APIStatusError as exc:
        report.update(status="failed")
        report["errors"] = [{"type": "provider_http_error", "status_code": exc.status_code}]
    except Exception:
        # Do not return repr/str/tracebacks: SDK exceptions can include request data.
        report.update(status="failed")
        report["errors"] = [{"type": "request_or_local_error", "message": "Request or local processing failed; no retry. Raw diagnostics withheld."}]
    finally:
        if guard is not None:
            report["provider_requests"] = guard.attempts
        if client is not None:
            report["token_usage"] = client.usage
            report["finish_reason"] = client.finish_reason
            with quiet_provider_logs():
                try:
                    client.close()
                except Exception:
                    report["cleanup_warning"] = "Transport cleanup failed; raw diagnostics withheld."
    return _redacted(report, config.api_key) if config is not None else report


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        # Never echo unknown arguments: an operator might accidentally paste a key.
        self.exit(2, "Invalid arguments. Use --help; credentials belong only in .env.\n")


def main(argv: list[str] | None = None) -> int:
    parser = SafeArgumentParser(description=__doc__)
    parser.add_argument("--execute-one-request", action="store_true", help="Explicitly opt in to one paid inference request; never use during preparation.")
    args = parser.parse_args(argv)
    result = run_smoke(execute=args.execute_one_request)
    print(json.dumps(result, indent=2))
    return 1 if result["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
