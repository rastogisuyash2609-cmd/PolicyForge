"""Opt-in, single-request smoke test; importing or preflighting makes no HTTP calls.

Run ``python -m policyforge.nebius_smoke`` for local preflight only.
The explicit ``--execute-one-request`` flag is required for paid inference.
"""

from __future__ import annotations

import argparse
import json
from threading import Lock
from typing import Any
from urllib.parse import quote

import httpx
import openai
from openai.types.chat import ChatCompletionMessageParam
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from policyforge.compiler import PolicyCompiler, _build_system_prompt, split_document_into_clauses
from policyforge.llm import LLMCallRecord, LLMClient
from policyforge.models import Rule
from policyforge.provider_safety import (
    MAX_OUTPUT_TOKENS, TIMEOUT_SECONDS, MAX_PROVIDER_REQUESTS, ALLOWED_HOSTS,
    SmokeGuardError, SmokeConfiguration, read_configuration, OneRequestTransport, quiet_provider_logs,
)

POLICY_TEXT = "Customers may request a refund within 30 days of delivery."
DOC_NAME = "synthetic_refund.md"
class SmokeEnvelope(BaseModel):
    """One synthetic clause must yield exactly one existing Pydantic IR Rule."""

    model_config = ConfigDict(extra="forbid")
    rules: list[Rule] = Field(min_length=1, max_length=1)


def build_smoke_messages() -> list[ChatCompletionMessageParam]:
    """Use the shared schema-derived instructions with the fixed refund vocabulary."""
    return [
        {"role": "system", "content": _build_system_prompt(refund_only=True)},
        {"role": "user", "content": f"Document: {DOC_NAME}\nPolicy: {POLICY_TEXT}"},
    ]


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
        self.reasoning_tokens: int | None = None
        self.visible_output_characters: int | None = None
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
                or messages[1].get("role") != "user"
                or POLICY_TEXT not in messages[1].get("content", "")):
            raise SmokeGuardError("Only the fixed JSON extraction operation is allowed.")
        prompt = build_smoke_messages()
        assert self._client is not None
        response = self._client.chat.completions.create(
            model=self.model, messages=prompt, temperature=0.0,
            response_format={"type": "json_object"},
            # Keep the already accepted Nebius parameter. NVIDIA's model card
            # alone does not establish Nebius support for chat_template_kwargs
            # or model-specific reasoning_effort. No speculative override/fallback.
            max_tokens=MAX_OUTPUT_TOKENS, n=1, stream=False,
        )
        if response.usage is not None:
            self.usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
            details = response.usage.completion_tokens_details
            if details is not None:
                self.reasoning_tokens = details.reasoning_tokens
        if len(response.choices) != 1:
            raise SmokeGuardError("The provider did not return exactly one completion.")
        choice = response.choices[0]
        self.finish_reason = choice.finish_reason
        self.visible_output_characters = len(choice.message.content or "")
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
        "reasoning_configuration": "provider_default_no_verified_override",
        "reasoning_tokens": None, "visible_output_characters": None,
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
            report["reasoning_tokens"] = client.reasoning_tokens
            report["visible_output_characters"] = client.visible_output_characters
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
