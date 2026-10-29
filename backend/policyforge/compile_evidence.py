"""Opt-in local test receipts. No provider access, raw prompts or request headers."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from policyforge.models import Rule

ProviderMode = Literal["nebius", "mock", "unknown"]
ValidationStatus = Literal["PASS", "FAIL", "NOT_RUN"]
ROOT = Path(__file__).resolve().parents[2]
TEST_ID_PATTERN = re.compile(r"[A-Z][A-Z0-9-]{0,31}")


class EvidenceError(RuntimeError):
    """Fixed local error; never includes file contents, paths or credentials."""


class CompileEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    test_id: str
    request_id: UUID
    timestamp: datetime
    completed_at: datetime | None = None
    provider_mode: ProviderMode
    model: str | None
    input_sha256: str | None = None
    status: Literal["pending", "success", "failed"] = "pending"
    # Pending means unknown: the process may have stopped after a billed request.
    provider_request_count: int | None = Field(default=None, ge=0, le=1)
    real_provider_requests_attempted: int | None = Field(default=None, ge=0, le=1)
    provider_response_received: bool | None = None
    real_provider_success: bool = False
    validated_policy_ir: list[Rule] | None = None
    pydantic_validation: ValidationStatus = "NOT_RUN"
    grounding_validation: ValidationStatus = "NOT_RUN"
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    finish_reason: str | None = None
    error_code: str | None = None
    truncated: bool = False


def configured_test_id() -> str | None:
    value = os.getenv("POLICYFORGE_LIVE_TEST_ID", "").strip()
    if not value:
        return None
    if TEST_ID_PATTERN.fullmatch(value) is None:
        raise EvidenceError("Configure a test ID using uppercase letters, digits and hyphens, up to 32 characters.")
    return value


def reject_secrets(value: Any) -> None:
    """Reject the whole receipt, never rewrite a business rule's meaning."""
    serialized = json.dumps(value, ensure_ascii=False, default=str)
    for name in ("NEBIUS_API_KEY", "POLICYFORGE_COMPILE_TOKEN"):
        secret = os.getenv(name, "")
        if secret and any(needle in serialized for needle in (
            secret, json.dumps(secret, ensure_ascii=False)[1:-1],
            json.dumps(secret, ensure_ascii=True)[1:-1],
        )):
            raise EvidenceError("Unsafe evidence was withheld.")


class EvidenceStore:
    """Owner-readable, Git-ignored JSON; exclusive begin and atomic final replace."""
    def __init__(self, directory: Path | None = None) -> None:
        self.directory = directory or Path(os.getenv(
            "POLICYFORGE_EVIDENCE_DIR", str(ROOT / ".local" / "compile-evidence")))

    def _path(self, request_id: str | UUID) -> Path:
        try:
            return self.directory / f"{UUID(str(request_id))}.json"
        except ValueError:
            raise EvidenceError("A UUID evidence correlation ID is required.") from None

    def _encoded(self, record: CompileEvidence) -> bytes:
        value = record.model_dump(mode="json")
        reject_secrets(value)
        return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")

    def begin(self, test_id: str, request_id: str, mode: ProviderMode,
              model: str | None, input_text: str | None = None) -> CompileEvidence:
        if TEST_ID_PATTERN.fullmatch(test_id) is None:
            raise EvidenceError("Invalid test ID; no inference was started.")
        resolved = self.directory.resolve()
        private_root = (ROOT / ".local" / "compile-evidence").resolve()
        if resolved.is_relative_to(ROOT) and not resolved.is_relative_to(private_root):
            raise EvidenceError("Use the ignored private evidence directory or private storage outside the checkout.")
        path = self._path(request_id)
        record = CompileEvidence(test_id=test_id, request_id=UUID(request_id),
                                 timestamp=datetime.now(timezone.utc), provider_mode=mode, model=model,
                                 input_sha256=sha256(input_text.encode("utf-8")).hexdigest() if input_text is not None else None)
        data = self._encoded(record)
        try:
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            # Existing UUIDs must never overwrite earlier evidence, even after restart.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
        except OSError:
            raise EvidenceError("Evidence could not be reserved; no inference was started.") from None
        return record

    def finish(self, record: CompileEvidence, *, mode: ProviderMode, attempts: int,
               response_received: bool, rules: list[Rule] | None,
               pydantic_status: ValidationStatus, grounding_status: ValidationStatus,
               usage: dict[str, int] | None, finish_reason: str | None,
               error_code: str | None) -> CompileEvidence:
        record = record.model_copy(deep=True)
        record.completed_at = datetime.now(timezone.utc)
        record.provider_mode = mode
        record.provider_request_count = attempts
        record.real_provider_requests_attempted = attempts if mode == "nebius" else 0
        record.provider_response_received = response_received
        record.pydantic_validation = pydantic_status
        record.grounding_validation = grounding_status
        record.finish_reason = finish_reason if finish_reason in {
            "stop", "length", "content_filter", "tool_calls", "function_call"} else None
        record.truncated = record.finish_reason == "length"
        record.error_code = error_code
        record.status = "success" if error_code is None else "failed"
        record.validated_policy_ir = rules if error_code is None else None
        record.real_provider_success = (mode == "nebius" and attempts == 1 and response_received
                                        and bool(rules) and finish_reason == "stop" and error_code is None
                                        and pydantic_status == grounding_status == "PASS")
        if usage is not None:
            record.input_tokens = usage.get("prompt_tokens")
            record.output_tokens = usage.get("completion_tokens")
            record.total_tokens = usage.get("total_tokens")
        # Validate assignment types/bounds before encoding, including enum-shaped statuses.
        record = CompileEvidence.model_validate_json(record.model_dump_json())
        data = self._encoded(record)
        target = self._path(record.request_id)
        temporary = self.directory / f".{record.request_id}.{uuid4()}.tmp"
        try:
            if not target.is_file():
                raise OSError("Missing reservation")
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        except OSError:
            raise EvidenceError("Final evidence could not be saved. The request may be billed; do not retry.") from None
        finally:
            temporary.unlink(missing_ok=True)
        return record

    def read(self, request_id: str) -> CompileEvidence:
        try:
            record = CompileEvidence.model_validate_json(self._path(request_id).read_bytes())
        except (OSError, ValidationError):
            raise EvidenceError("Evidence is missing or incomplete; do not infer a zero request count.") from None
        self._encoded(record)  # Recheck configured-secret safety before CLI output.
        return record

    def list(self, test_id: str | None = None) -> list[CompileEvidence]:
        records = [self.read(p.stem) for p in sorted(self.directory.glob("*.json"))]
        return sorted((r for r in records if test_id is None or r.test_id == test_id),
                      key=lambda record: record.timestamp)


def main(argv: list[str] | None = None) -> int:
    # Load local secrets solely for the no-secret-output check; never create a client.
    from policyforge.llm import load_backend_environment
    load_backend_environment()
    parser = argparse.ArgumentParser(description="Inspect saved local compilation evidence without inference.")
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("list")
    listing.add_argument("--test-id")
    show = commands.add_parser("show")
    show.add_argument("request_id")
    args = parser.parse_args(argv)
    store = EvidenceStore()
    try:
        if args.command == "show":
            print(store.read(args.request_id).model_dump_json(indent=2))
        else:
            print(json.dumps([{
                "test_id": r.test_id, "request_id": str(r.request_id), "timestamp": r.timestamp.isoformat(),
                "provider_mode": r.provider_mode, "status": r.status,
                "real_provider_success": r.real_provider_success,
                "provider_request_count": r.provider_request_count,
            } for r in store.list(args.test_id)], indent=2))
    except EvidenceError as exc:
        print(str(exc))
        return 1
    return 0
