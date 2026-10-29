"""All provider responses are mocked; no live credential or inference is used."""
import json
from pathlib import Path
from typing import Any
from uuid import uuid4
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from policyforge.api import app
from policyforge import live_compile as live

SECRET = "offline-provider-secret-not-a-real-key"
ACCESS = "offline-workspace-access-not-a-real-token"
CLIENT_CLASS = live.BoundedCompileClient
TEXT = "Customers may request a refund within 30 days of delivery."


def envelope() -> dict[str, Any]:
    data = json.loads((Path(__file__).parent / "fixtures/nebius_smoke/valid_policy_ir.json").read_text())
    data["rules"][0]["source"]["doc_name"] = "policy.md"
    return data


def completion(data: Any, finish: str = "stop") -> httpx.Response:
    return httpx.Response(200, json={"id": "offline", "object": "chat.completion", "created": 0,
        "model": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", "choices": [{"index": 0,
        "finish_reason": finish, "message": {"role": "assistant", "content": data if isinstance(data, str) else json.dumps(data)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 80, "total_tokens": 180}})


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    for name, value in {"POLICYFORGE_ENABLE_LIVE_AI": "true", "POLICYFORGE_COMPILE_TOKEN": ACCESS,
        "NEBIUS_API_KEY": SECRET, "NEBIUS_MODEL": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        "NEBIUS_BASE_URL": "https://api.tokenfactory.nebius.com/v1/"}.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(live, "gate", live.CompileGate())
    calls: list[httpx.Request] = []
    original = live.BoundedCompileClient
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return completion(envelope())
    monkeypatch.setattr(live, "BoundedCompileClient", lambda: original(httpx.MockTransport(handle)))
    return calls


def post(**overrides: Any) -> httpx.Response:
    return TestClient(app).post("/api/compile", headers={"Authorization": "Bearer " + ACCESS,
        "Idempotency-Key": str(uuid4())}, json={"document_text": TEXT, "doc_name": "policy.md", "live": True, **overrides})


def test_live_endpoint_is_default_off_even_with_credentials(configured: list, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POLICYFORGE_ENABLE_LIVE_AI")
    assert post().status_code == 503
    assert configured == []


def test_success_has_one_bounded_request_and_real_local_compiler(configured: list[httpx.Request]) -> None:
    response = post()
    assert response.status_code == 200
    data = response.json()
    assert data["provider_requests"] == len(configured) == 1
    assert data["rule_confidence"]["refund_30_days"]["grounded"] is True
    assert data["token_usage"]["provider_usage"]["total_tokens"] == 180
    body = json.loads(configured[0].content)
    assert body["max_tokens"] == 1536 and body["n"] == 1 and body["stream"] is False
    assert set(configured[0].extensions["timeout"].values()) == {30.0}
    assert SECRET not in response.text and ACCESS not in response.text


@pytest.mark.parametrize("payload", [{"live": False}, {"document_text": " "}, {"document_text": "x" * 4001},
    {"documents": {"a": TEXT}}, {"max_repairs": 1}, {"max_tokens": 999999}, {"use_mock": True}])
def test_unsafe_or_non_explicit_inputs_never_infer(configured: list, payload: dict[str, Any]) -> None:
    assert post(**payload).status_code >= 400
    assert configured == []


def test_missing_access_credentials_and_request_id_are_local_only(configured: list, monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    assert client.post("/api/compile", json={"document_text": TEXT, "live": True}).status_code == 401
    assert client.post("/api/compile", headers={"Authorization": "Bearer " + ACCESS}, json={"document_text": TEXT, "live": True}).status_code == 422
    monkeypatch.delenv("NEBIUS_API_KEY")
    assert post().status_code == 503
    assert configured == []


@pytest.mark.parametrize("case,status", [("json", 422), ("schema", 422), ("grounding", 422),
    ("length", 422), ("empty", 422), ("echo", 502), ("timeout", 504), ("401", 502),
    ("402", 502), ("403", 502), ("429", 429), ("503", 502)])
def test_failures_are_sanitized_and_never_retry(configured: list, monkeypatch: pytest.MonkeyPatch, case: str, status: int, caplog: pytest.LogCaptureFixture) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        configured.append(request)
        if case.isdigit(): return httpx.Response(int(case), json={"error": {"message": SECRET}})
        if case == "timeout": raise httpx.ReadTimeout(SECRET, request=request)
        data = envelope()
        if case == "json": return completion('{"rules":[')
        if case == "schema": data["rules"][0]["when"] = {"days_since_delivery": {"op": "LTE", "value": 30}}
        if case == "grounding": data["rules"][0]["source"]["verbatim_sentence"] = "Invented policy text."
        if case == "empty": data["rules"] = []
        if case == "echo": data["rules"][0]["name"] = SECRET
        return completion(data, "length" if case == "length" else "stop")
    monkeypatch.setattr(live, "BoundedCompileClient", lambda: CLIENT_CLASS(httpx.MockTransport(handle)))
    response = post()
    assert response.status_code == status
    assert len(configured) == response.json()["detail"]["provider_requests"] == 1
    assert SECRET not in response.text + caplog.text
    assert ACCESS not in response.text + caplog.text


def test_duplicate_requests_and_duplicate_policy_are_not_billed(configured: list) -> None:
    headers = {"Authorization": "Bearer " + ACCESS, "Idempotency-Key": str(uuid4())}
    client = TestClient(app)
    body = {"document_text": TEXT, "doc_name": "policy.md", "live": True}
    assert client.post("/api/compile", headers=headers, json=body).status_code == 200
    assert client.post("/api/compile", headers=headers, json=body).status_code == 409
    assert post().status_code == 409
    assert len(configured) == 1


def test_gate_concurrency_rate_and_session_budget() -> None:
    now = [1000.0]
    gate = live.CompileGate(lambda: now[0])
    with gate.reserve("first", "a", 3):
        with pytest.raises(HTTPException, match="429"):
            with gate.reserve("parallel", "b", 3): pass
    with gate.reserve("second", "b", 3): pass
    with pytest.raises(HTTPException):
        with gate.reserve("rate", "c", 3): pass
    now[0] += 61
    with gate.reserve("third", "c", 3): pass
    now[0] += 61
    with pytest.raises(HTTPException):
        with gate.reserve("budget", "d", 3): pass
    assert gate.attempts == 3 and not gate.active


@pytest.mark.parametrize("invalid_authorization", ["Bearer invalid", "Basic invalid", "Bearer " + SECRET])
def test_wrong_workspace_authorization_never_reaches_provider(
    configured: list[httpx.Request], invalid_authorization: str,
) -> None:
    response = TestClient(app).post("/api/compile", headers={
        "Authorization": invalid_authorization, "Idempotency-Key": str(uuid4()),
    }, json={"document_text": TEXT, "live": True})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "access_denied"
    assert configured == [] and live.gate.attempts == 0


def test_provider_key_cannot_be_used_as_workspace_code(
    configured: list[httpx.Request], monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POLICYFORGE_COMPILE_TOKEN", SECRET)
    response = post()
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "access_not_configured"
    assert configured == [] and live.gate.attempts == 0


@pytest.mark.parametrize("invalid_output", [False, True], ids=["success", "validation_failure"])
def test_one_attempt_session_budget_blocks_new_policy_after_success_or_failure(
    configured: list[httpx.Request], monkeypatch: pytest.MonkeyPatch, invalid_output: bool,
) -> None:
    monkeypatch.setenv("POLICYFORGE_AI_REQUEST_BUDGET", "1")
    now = [1000.0]
    monkeypatch.setattr(live, "gate", live.CompileGate(lambda: now[0]))

    def handle(request: httpx.Request) -> httpx.Response:
        configured.append(request)
        return completion("invalid JSON" if invalid_output else envelope())

    monkeypatch.setattr(live, "BoundedCompileClient", lambda: CLIENT_CLASS(httpx.MockTransport(handle)))
    assert post().status_code == (422 if invalid_output else 200)
    # New content/UUID after rate and content cooldowns must still hit the hard budget.
    now[0] += 301
    response = post(document_text="Refunds are allowed within 14 days of delivery.")
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "budget_limit"
    assert len(configured) == live.gate.attempts == 1
    assert not live.gate.active


def test_body_limit_and_cors(configured: list) -> None:
    client = TestClient(app)
    assert client.post("/api/compile", content=b"x" * 17000).status_code == 413
    allowed = client.options("/api/compile", headers={"Origin": "http://127.0.0.1:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,idempotency-key,content-type"})
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    denied = client.options("/api/compile", headers={"Origin": "https://untrusted.invalid", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in denied.headers
    assert configured == []


def test_mixed_condition_nodes_are_rejected_before_existing_rule_parser() -> None:
    data = envelope()
    data["rules"][0]["when"] = {"all": [{"field":"days_since_delivery","op":"LTE","value":30}],
                                  "days_since_delivery": {"op":"GT","value":90}}
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        live.PolicyEnvelope.model_validate(data)


@pytest.mark.parametrize("secret", ['offline-"quoted"-provider-credential', "offline-unicode-credential-\u00e9"])
def test_escaped_provider_key_echo_is_rejected(configured: list, monkeypatch: pytest.MonkeyPatch, secret: str) -> None:
    monkeypatch.setenv("NEBIUS_API_KEY", secret)
    def handle(request: httpx.Request) -> httpx.Response:
        configured.append(request)
        data = envelope()
        data["rules"][0]["name"] = secret
        return completion(data)
    monkeypatch.setattr(live, "BoundedCompileClient", lambda: CLIENT_CLASS(httpx.MockTransport(handle)))
    response = post()
    # HTTP header encodings can reject non-ASCII credentials locally before send.
    assert response.status_code == 502
    assert secret not in response.text and json.dumps(secret)[1:-1] not in response.text
    assert len(configured) <= 1


def test_client_has_zero_retries_and_no_second_call_after_invalid_output(configured: list) -> None:
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return completion("not JSON")
    client = CLIENT_CLASS(httpx.MockTransport(handle))
    assert client.sdk.max_retries == client.max_retries == 0
    try:
        from pydantic import ValidationError
        with pytest.raises(ValidationError): client.chat_complete([{"role":"user","content":TEXT}])
        with pytest.raises(live.SmokeGuardError): client.chat_complete([{"role":"user","content":TEXT}])
        assert len(calls) == client.transport.attempts == 1
    finally:
        client.close()
