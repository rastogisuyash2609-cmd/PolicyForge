"""Stage 2 extraction fixtures and deterministic boundary expectations, all offline."""
import json
from pathlib import Path
from typing import Any
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from policyforge.api import app
from policyforge import live_compile as live
from policyforge.compiler import check_source_grounding
from policyforge.engine import PolicyEngine
from policyforge.models import Rule, Event, StateField, Operator

CASES = json.loads((Path(__file__).parent / "fixtures/stage2/policy_cases.json").read_text(encoding="utf-8"))
CLIENT_CLASS = live.BoundedCompileClient


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_stage2_grounding_and_expected_behavior(case: dict[str, Any]) -> None:
    rules = [Rule.model_validate_json(json.dumps(r)) for r in case["rules"]]
    assert not case["live_inference_required_for_offline_tests"]
    for field in case["supported_fields"]: StateField(field)
    for op in case["supported_operators"]: Operator(op)
    for rule in rules:
        assert rule.source.doc_name == case["doc_name"]
        assert check_source_grounding(rule.source.verbatim_sentence, case["document_text"])
    for check in case["checks"]:
        result = PolicyEngine(rules).run([Event.model_validate(e) for e in check["journey"]])
        assert result.outcomes[-1].outcome.value == check["outcome"]
    if not rules:
        assert "clarification" in case["validation"]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_stage2_mocked_whole_document_compile(case: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in {"POLICYFORGE_ENABLE_LIVE_AI": "true", "POLICYFORGE_COMPILE_TOKEN": "offline-workspace-access-code-only",
                       "NEBIUS_API_KEY": "offline-provider-credential-only",
                       "NEBIUS_MODEL": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
                       "NEBIUS_BASE_URL": "https://api.tokenfactory.nebius.com/v1/"}.items(): monkeypatch.setenv(key, value)
    monkeypatch.setattr(live, "gate", live.CompileGate())
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"id":"offline","object":"chat.completion","created":0,
            "model":"nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B","choices":[{"index":0,"finish_reason":"stop",
            "message":{"role":"assistant","content":json.dumps({"rules":case["rules"]})}}]})
    monkeypatch.setattr(live, "BoundedCompileClient", lambda: CLIENT_CLASS(httpx.MockTransport(handle)))
    response = TestClient(app).post("/api/compile", headers={"Authorization":"Bearer offline-workspace-access-code-only",
        "Idempotency-Key":str(uuid4())}, json={"document_text":case["document_text"],"doc_name":case["doc_name"],"live":True})
    assert response.status_code == (200 if case["rules"] else 422)
    assert len(calls) == 1
    if case["rules"]:
        assert len(response.json()["compiled_rules"]) == len(case["rules"])
