"""Opt-in, operator-authorized whole-document extraction with a bounded budget."""
from __future__ import annotations

from collections import deque
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from secrets import compare_digest
from threading import Lock
import time
from typing import Any, Callable, Iterator, cast
from uuid import UUID

import httpx
import openai
from openai.types.chat import ChatCompletionMessageParam
from pydantic import BaseModel, ConfigDict, Field, ValidationError, TypeAdapter, model_validator
from fastapi import HTTPException

from policyforge.compiler import PolicyCompiler
from policyforge.llm import LLMClient, LLMCallRecord
from policyforge.models import Rule, ConditionTree
from policyforge.provider_safety import (
    MAX_OUTPUT_TOKENS, TIMEOUT_SECONDS, OneRequestTransport,
    SmokeGuardError, read_configuration, quiet_provider_logs,
)

MAX_POLICY_CHARACTERS = 4000


class PolicyEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: list[Rule] = Field(min_length=1, max_length=8)

    @model_validator(mode="before")
    @classmethod
    def reject_lossy_condition_shapes(cls, value: Any) -> Any:
        # Rule's existing pre-parser selects group keys. Validate the original
        # recursive union first so mixed/extra keys cannot be silently dropped.
        if isinstance(value, dict) and isinstance(value.get("rules"), list):
            adapter = TypeAdapter(ConditionTree)
            for rule in value["rules"]:
                if isinstance(rule, dict) and "when" in rule:
                    adapter.validate_python(rule["when"])
        return value


class CompileGate:
    """Single-worker guard. Budget is process-local and never restored on failure."""
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock = clock
        self.lock = Lock()
        self.active = False
        self.attempts = 0
        self.recent: deque[float] = deque()
        self.seen_ids: set[str] = set()
        self.seen_content: dict[str, float] = {}

    @contextmanager
    def reserve(self, request_id: str, text: str, budget: int) -> Iterator[None]:
        now = self.clock()
        fingerprint = sha256(text.encode("utf-8")).hexdigest()
        with self.lock:
            if request_id in self.seen_ids or now - self.seen_content.get(fingerprint, -1000) < 300:
                raise HTTPException(409, {"code": "duplicate", "message": "Duplicate compilation blocked. No additional inference was sent; wait five minutes before an intentional repeat."})
            if self.active:
                raise HTTPException(429, {"code": "busy", "message": "A compilation is already running. No additional inference was sent."})
            while self.recent and now - self.recent[0] >= 60:
                self.recent.popleft()
            if len(self.recent) >= 2:
                raise HTTPException(429, {"code": "rate_limit", "message": "Compilation limit reached: two attempts per minute."})
            if self.attempts >= budget:
                raise HTTPException(429, {"code": "budget_limit", "message": "The backend session compilation budget is exhausted. Contact the workspace owner."})
            self.active = True
            self.attempts += 1
            self.recent.append(now)
            self.seen_ids.add(request_id)
            self.seen_content = {k: v for k, v in self.seen_content.items() if now - v < 300}
            self.seen_content[fingerprint] = now
        try:
            yield
        finally:
            with self.lock:
                self.active = False


gate = CompileGate()


class BoundedCompileClient(LLMClient):
    """Existing compiler interface; one JSON completion, no repair or retry loop."""
    def __init__(self, inner_transport: httpx.BaseTransport | None = None) -> None:
        configuration = read_configuration()
        self.model = configuration.model
        self.timeout = TIMEOUT_SECONDS
        self.max_retries = 0
        self.call_history: list[LLMCallRecord] = []
        self.usage: dict[str, int] | None = None
        self.finish_reason: str | None = None
        self.used = False
        self.transport = OneRequestTransport(configuration.base_url, inner_transport if inner_transport is not None else httpx.HTTPTransport(retries=0))
        self.sdk = openai.OpenAI(
            api_key=configuration.api_key.get_secret_value(), base_url=configuration.base_url,
            timeout=TIMEOUT_SECONDS, max_retries=0,
            http_client=httpx.Client(transport=self.transport, timeout=TIMEOUT_SECONDS,
                                     follow_redirects=False, trust_env=False),
        )

    def chat_complete(self, messages: list[dict[str, str]], temperature: float = 0.0,
                      response_format: dict[str, Any] | None = None) -> str:
        if self.used:
            raise SmokeGuardError("A second model call is forbidden.")
        self.used = True
        response = self.sdk.chat.completions.create(
            model=self.model, messages=cast(list[ChatCompletionMessageParam], messages),
            temperature=0, response_format={"type": "json_object"},
            max_tokens=MAX_OUTPUT_TOKENS, n=1, stream=False,
        )
        if response.usage is not None:
            self.usage = {"prompt_tokens": response.usage.prompt_tokens,
                          "completion_tokens": response.usage.completion_tokens,
                          "total_tokens": response.usage.total_tokens}
        if len(response.choices) != 1:
            raise SmokeGuardError("Incomplete model response.")
        choice = response.choices[0]
        self.finish_reason = choice.finish_reason
        if choice.finish_reason != "stop" or choice.message.refusal:
            raise SmokeGuardError("Incomplete model response.")
        return PolicyEnvelope.model_validate_json(choice.message.content or "").model_dump_json()

    def get_total_usage(self) -> dict[str, Any]:
        return {"call_count": self.transport.attempts, "provider_usage": self.usage}

    def close(self) -> None:
        self.sdk.close()


def authorize(authorization: str | None, live: bool) -> int:
    if not live or os.getenv("POLICYFORGE_ENABLE_LIVE_AI", "false").lower() != "true":
        raise HTTPException(503, {"code": "live_disabled", "message": "Live compilation is disabled by the workspace owner. Demo and manual rules remain available."})
    token = os.getenv("POLICYFORGE_COMPILE_TOKEN", "")
    if len(token) < 24 or token == os.getenv("NEBIUS_API_KEY"):
        raise HTTPException(503, {"code": "access_not_configured", "message": "The owner must configure a separate workspace access code."})
    if not authorization or not compare_digest(authorization.encode(), ("Bearer " + token).encode()):
        raise HTTPException(401, {"code": "access_denied", "message": "A valid workspace access code is required."})
    try:
        return min(10, max(1, int(os.getenv("POLICYFORGE_AI_REQUEST_BUDGET", "3"))))
    except ValueError:
        raise HTTPException(503, {"code": "configuration", "message": "The backend compilation budget is not configured correctly."}) from None


def compile_live(text: str, doc_name: str, request_id: str | None,
                 authorization: str | None, live: bool) -> dict[str, Any]:
    budget = authorize(authorization, live)
    if not text.strip() or len(text) > MAX_POLICY_CHARACTERS or not doc_name.strip() or len(doc_name) > 120:
        raise HTTPException(422, {"code": "input", "message": "Provide policy text from 1 to 4000 characters and a document name up to 120 characters."})
    try:
        UUID(request_id or "")
    except ValueError:
        raise HTTPException(422, {"code": "request_id", "message": "A unique UUID Idempotency-Key is required."}) from None
    # Validate locally before reserving a provider attempt. Never return config values.
    try:
        configuration = read_configuration()
    except (SmokeGuardError, ValueError):
        raise HTTPException(503, {"code": "credentials_missing", "message": "Backend Nebius credentials, endpoint or model configuration is missing or invalid."}) from None
    client: BoundedCompileClient | None = None
    with gate.reserve(request_id or "", text, budget), quiet_provider_logs():
        try:
            client = BoundedCompileClient()
            compiler = PolicyCompiler(llm_client=client, max_repairs=0)
            report = compiler.compile_document(text, doc_name, whole_document=True)
            rules = report.compiled_rules
            if (report.rejected_rules or report.unmapped_clauses or not rules
                    or any(r.source.doc_name != doc_name for r in rules)
                    or len({r.id for r in rules}) != len(rules)):
                raise HTTPException(422, {"code": "grounding_or_rules", "message": "Generated rules failed local grounding or rule validation. Previous rules were preserved; no repair was attempted."})
            result = {
                "total_clauses": report.total_clauses, "mapped_clauses": report.mapped_clauses,
                "unmapped_clauses": [], "compiled_rules": [r.model_dump(mode="json") for r in rules],
                "rule_confidence": {k: vars(v) for k, v in report.rule_confidence.items()},
                "rejected_rules": [], "lint_warnings": report.lint_warnings,
                "token_usage": client.get_total_usage(), "latency_ms": round(report.latency_ms, 2),
                "summary": "One whole-document extraction validated locally. Review rules for omissions and meaning before activation.",
                "mode": "live", "model": client.model, "request_id": request_id,
                "finish_reason": client.finish_reason, "provider_requests": client.transport.attempts,
                "max_output_tokens": MAX_OUTPUT_TOKENS, "timeout_seconds": TIMEOUT_SECONDS,
            }
            serialized = json.dumps(result, ensure_ascii=False)
            if any(secret and json.dumps(secret, ensure_ascii=False)[1:-1] in serialized for secret in (
                    configuration.api_key.get_secret_value(), os.getenv("POLICYFORGE_COMPILE_TOKEN", ""))):
                raise HTTPException(502, {"code": "unsafe_output", "message": "Unsafe provider output was rejected. No rules were accepted."})
            return result
        except HTTPException as exc:
            error = exc
        except ValidationError:
            error = HTTPException(422, {"code": "invalid_policy_ir", "message": "The model returned invalid JSON or Policy IR. No repair or retry was attempted."})
        except SmokeGuardError:
            error = HTTPException(422, {"code": "incomplete", "message": "The model response was truncated, refused or incomplete. Shorten the policy before a separately authorized attempt."})
        except openai.APITimeoutError:
            error = HTTPException(504, {"code": "provider_timeout", "message": "The provider timed out. It may still bill this attempt. Do not immediately repeat it."})
        except openai.APIStatusError as exc:
            code, message = {
                401: ("provider_auth", "Backend Nebius authentication failed; contact the workspace owner."),
                403: ("model_access", "Backend model access was denied; contact the workspace owner."),
                402: ("insufficient_credits", "Nebius reported insufficient credits; contact the workspace owner."),
                429: ("provider_rate_limit", "Nebius rate-limited this request. No retry was attempted."),
            }.get(exc.status_code, ("provider_error", "The provider rejected the request. No retry was attempted."))
            try:
                provider_code = exc.response.json().get("error", {}).get("code")
            except (ValueError, AttributeError):
                provider_code = None
            if provider_code in ("insufficient_quota", "insufficient_balance", "insufficient_credits"):
                code, message = "insufficient_credits", "Nebius reported insufficient credits; contact the workspace owner."
            error = HTTPException(429 if exc.status_code == 429 else 502, {"code": code, "message": message})
        except Exception:
            error = HTTPException(502, {"code": "compilation_failed", "message": "Compilation failed. Raw provider diagnostics were withheld; no retry was attempted."})
        finally:
            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass
        error.detail.update(request_id=request_id, provider_requests=client.transport.attempts if client else 0,
                            token_usage=client.get_total_usage() if client else None)
        raise error from None
