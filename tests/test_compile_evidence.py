"""Evidence receipts are tested with local fixtures and SDK MockTransport only."""
from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from policyforge.api import app
from policyforge import live_compile as live
from policyforge.compile_evidence import EvidenceError, EvidenceStore, ProviderMode
from policyforge.inspect_compile_evidence import main
from policyforge.models import Rule

SECRET = "offline-evidence-provider-secret-only"
ACCESS = "offline-evidence-workspace-access-only"
MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
TEXT = "Customers may request a refund within 30 days of delivery."
CLIENT_CLASS = live.BoundedCompileClient


def envelope() -> dict[str, Any]:
    value = json.loads((Path(__file__).parent / "fixtures/nebius_smoke/valid_policy_ir.json").read_text())
    value["rules"][0]["source"]["doc_name"] = "policy.md"
    return value


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> EvidenceStore:
    for name, value in {
        "POLICYFORGE_LIVE_TEST_ID": "OFFLINE-01", "POLICYFORGE_EVIDENCE_DIR": str(tmp_path),
        "POLICYFORGE_ENABLE_LIVE_AI": "true", "POLICYFORGE_AI_REQUEST_BUDGET": "1",
        "POLICYFORGE_COMPILE_TOKEN": ACCESS, "NEBIUS_API_KEY": SECRET,
        "NEBIUS_MODEL": MODEL, "NEBIUS_BASE_URL": "https://api.tokenfactory.nebius.com/v1/",
    }.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(live, "gate", live.CompileGate())
    return EvidenceStore(tmp_path)


def post(request_id: str, **kwargs: Any) -> httpx.Response:
    return TestClient(app).post("/api/compile", headers={
        "Authorization": "Bearer " + ACCESS, "Idempotency-Key": request_id,
    }, json={"document_text": TEXT, "doc_name": "policy.md", "live": True, **kwargs})


def install_response(monkeypatch: pytest.MonkeyPatch, data: Any, *, finish: str = "stop",
                     status: int = 200, timeout: bool = False, usage: bool = True) -> list[httpx.Request]:
    calls: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if timeout:
            raise httpx.ReadTimeout(SECRET, request=request)
        if status != 200:
            return httpx.Response(status, json={"error": {"message": SECRET}})
        body = {"id": "offline", "object": "chat.completion", "created": 0, "model": MODEL,
                "choices": [{"index": 0, "finish_reason": finish, "message": {
                    "role": "assistant", "content": data if isinstance(data, str) else json.dumps(data)}}]}
        if usage:
            body["usage"] = {"prompt_tokens": 100, "completion_tokens": 80, "total_tokens": 180}
        return httpx.Response(200, json=body)

    monkeypatch.setattr(live, "BoundedCompileClient", lambda: CLIENT_CLASS(httpx.MockTransport(handle)))
    return calls


def test_complete_mocked_sdk_receipt_recovers_after_new_store_and_live_disabled(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    calls = install_response(monkeypatch, envelope())
    request_id = str(uuid4())
    response = post(request_id)
    assert response.status_code == 200
    assert response.json()["provider_mode"] == "mock"
    assert response.json()["evidence"] == {"test_id": "OFFLINE-01", "request_id": request_id, "status": "saved"}
    monkeypatch.setenv("POLICYFORGE_ENABLE_LIVE_AI", "false")
    record = EvidenceStore(configured.directory).read(request_id)
    assert record.test_id == "OFFLINE-01" and record.model == MODEL
    assert record.input_sha256 == sha256(TEXT.encode("utf-8")).hexdigest()
    assert record.status == "success" and record.completed_at and record.timestamp <= record.completed_at
    assert record.provider_request_count == len(calls) == 1
    assert record.real_provider_requests_attempted == 0 and not record.real_provider_success
    assert record.provider_mode == "mock" and record.provider_response_received
    assert record.pydantic_validation == record.grounding_validation == "PASS"
    assert record.validated_policy_ir and record.validated_policy_ir[0].decision.value == "REFUND"
    assert (record.input_tokens, record.output_tokens, record.total_tokens) == (100, 80, 180)
    assert record.finish_reason == "stop" and not record.truncated and record.error_code is None
    encoded = (configured.directory / f"{request_id}.json").read_text(encoding="utf-8")
    for withheld in (SECRET, ACCESS, "Authorization", "document_text", "user_agent", "client_ip"):
        assert withheld not in encoded
    assert main(["show", request_id]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["validated_policy_ir"] == response.json()["compiled_rules"]
    assert main(["list", "--test-id", "OFFLINE-01"]) == 0
    assert json.loads(capsys.readouterr().out)[0]["request_id"] == request_id
    assert len(calls) == 1  # CLI recovery never invokes the SDK.


@pytest.mark.parametrize("failure", ["json", "schema", "grounding", "length", "timeout", "401", "402", "429", "key_echo", "access_echo"])
def test_failures_are_durable_safe_and_never_retry(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch, failure: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    data: Any = envelope()
    if failure == "json":
        data = '{"rules":['
    if failure == "schema":
        data["rules"][0]["when"] = {"days_since_delivery": {"op": "LTE", "value": 30}}
    if failure == "grounding":
        data["rules"][0]["source"]["verbatim_sentence"] = "Invented quotation."
    if failure in {"key_echo", "access_echo"}:
        data["rules"][0]["name"] = SECRET if failure == "key_echo" else ACCESS
    calls = install_response(monkeypatch, data, finish="length" if failure == "length" else "stop",
                             timeout=failure == "timeout", status=int(failure) if failure.isdigit() else 200)
    request_id = str(uuid4())
    response = post(request_id)
    assert response.status_code >= 400 and len(calls) == 1
    record = configured.read(request_id)
    assert record.status == "failed" and record.error_code
    assert record.provider_mode == "mock" and record.real_provider_requests_attempted == 0
    assert record.provider_request_count == 1 and not record.real_provider_success
    assert record.validated_policy_ir is None
    assert record.truncated == (failure == "length")
    if failure in {"json", "schema"}:
        assert record.pydantic_validation == "FAIL" and record.grounding_validation == "NOT_RUN"
    if failure == "grounding":
        assert record.pydantic_validation == "PASS" and record.grounding_validation == "FAIL"
    saved = (configured.directory / f"{request_id}.json").read_text(encoding="utf-8")
    for secret in (SECRET, ACCESS):
        assert secret not in saved + response.text + caplog.text
    # Errors consume the original process allowance, not a new inference/repair.
    assert post(str(uuid4()), document_text="Different policy.").status_code == 429
    assert len(calls) == 1 and len(configured.list()) == 1


def test_missing_usage_stays_unknown(configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch) -> None:
    install_response(monkeypatch, envelope(), usage=False)
    request_id = str(uuid4())
    assert post(request_id).status_code == 200
    record = configured.read(request_id)
    assert record.input_tokens is record.output_tokens is record.total_tokens is None


def test_explicit_mock_http_200_is_saved_as_zero_real_requests(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POLICYFORGE_ENABLE_LIVE_AI", "false")
    request_id = str(uuid4())
    response = post(request_id, live=False, use_mock=True)
    assert response.status_code == 200
    assert response.json()["mode"] == response.json()["provider_mode"] == "mock"
    assert response.json()["provider_requests"] == 0
    record = configured.read(request_id)
    assert record.provider_mode == "mock" and record.provider_request_count == 0
    assert not record.real_provider_success and record.real_provider_requests_attempted == 0
    assert live.gate.attempts == 0


def test_unauthorized_or_disabled_live_request_never_creates_receipts(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POLICYFORGE_ENABLE_LIVE_AI", "false")
    assert post(str(uuid4())).status_code == 503
    assert configured.list() == []
    assert TestClient(app).post("/api/compile", json={"document_text": TEXT, "use_mock": True}).status_code == 401
    assert configured.list() == []


def test_reservation_write_failure_prevents_inference(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = install_response(monkeypatch, envelope())

    def fail(*args: Any, **kwargs: Any) -> Any:
        raise EvidenceError("Fixed local error.")

    monkeypatch.setattr(EvidenceStore, "begin", fail)
    response = post(str(uuid4()))
    assert response.status_code == 503 and response.json()["detail"]["code"] == "evidence_unavailable"
    assert calls == []


def test_finalize_failure_leaves_pending_unknown_not_false_success(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = install_response(monkeypatch, envelope())

    def fail(*args: Any, **kwargs: Any) -> Any:
        raise EvidenceError("Fixed local error.")

    monkeypatch.setattr(EvidenceStore, "finish", fail)
    request_id = str(uuid4())
    response = post(request_id)
    assert response.status_code == 503 and response.json()["detail"]["code"] == "evidence_write_failed"
    pending = configured.read(request_id)
    assert pending.status == "pending" and pending.provider_request_count is None
    assert pending.validated_policy_ir is None and not pending.real_provider_success
    assert len(calls) == 1


def test_same_correlation_id_cannot_overwrite_after_process_restart(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = install_response(monkeypatch, envelope())
    request_id = str(uuid4())
    assert post(request_id).status_code == 200
    original = (configured.directory / f"{request_id}.json").read_bytes()
    monkeypatch.setattr(live, "gate", live.CompileGate())  # Simulated restart, mocked only.
    assert post(request_id).status_code == 503
    assert len(calls) == 1 and (configured.directory / f"{request_id}.json").read_bytes() == original


@pytest.mark.parametrize("secret", ['offline-"quoted"-credential', 'offline-unicode-credential-\u00e9'])
def test_store_rejects_secret_values_without_recording_them(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch, secret: str,
) -> None:
    monkeypatch.setenv("NEBIUS_API_KEY", secret)
    with pytest.raises(EvidenceError, match="Unsafe evidence"):
        configured.begin("OFFLINE-01", str(uuid4()), "unknown", secret)
    assert configured.list() == []


def test_cli_rejects_traversal_and_corrupt_evidence_without_dumping_contents(
    configured: EvidenceStore, capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["show", "../.env"]) == 1
    assert SECRET not in capsys.readouterr().out
    request_id = str(uuid4())
    (configured.directory / f"{request_id}.json").write_text(SECRET)
    assert main(["show", request_id]) == 1
    assert SECRET not in capsys.readouterr().out


@pytest.mark.parametrize("mode,response_received,attempts,expected", [
    ("nebius", True, 1, True), ("nebius", False, 1, False),
    ("nebius", True, 0, False), ("mock", True, 1, False), ("unknown", False, 0, False),
])
def test_real_success_requires_all_provider_evidence_fields(
    configured: EvidenceStore, mode: ProviderMode, response_received: bool, attempts: int, expected: bool,
) -> None:
    # Pure fixture classification, not a provider request or real success report.
    receipt = configured.begin("OFFLINE-01", str(uuid4()), "unknown", MODEL)
    rules = [Rule.model_validate(r) for r in envelope()["rules"]]
    saved = configured.finish(receipt, mode=mode, attempts=attempts, response_received=response_received,
        rules=rules, pydantic_status="PASS", grounding_status="PASS", usage=None, finish_reason="stop", error_code=None)
    assert saved.real_provider_success == expected


def test_atomic_final_write_failure_preserves_pending_file(
    configured: EvidenceStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    import policyforge.compile_evidence as evidence
    receipt = configured.begin("OFFLINE-01", str(uuid4()), "unknown", MODEL)

    def fail(*args: Any, **kwargs: Any) -> Any:
        raise OSError(SECRET)

    monkeypatch.setattr(evidence.os, "replace", fail)
    with pytest.raises(EvidenceError, match="do not retry"):
        configured.finish(receipt, mode="mock", attempts=1, response_received=True,
            rules=None, pydantic_status="FAIL", grounding_status="NOT_RUN", usage=None,
            finish_reason="stop", error_code="invalid_policy_ir")
    assert configured.read(str(receipt.request_id)).status == "pending"
    assert not list(configured.directory.glob("*.tmp"))


def test_public_or_tracked_checkout_directory_is_rejected_before_writing() -> None:
    from policyforge.compile_evidence import ROOT
    store = EvidenceStore(ROOT / "frontend" / "public" / "evidence")
    with pytest.raises(EvidenceError, match="private"):
        store.begin("OFFLINE-01", str(uuid4()), "mock", None)
    assert not store.directory.exists()
