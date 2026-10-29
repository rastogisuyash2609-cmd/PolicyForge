"""Advanced extraction preparation: synthetic fixtures, no provider network."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from policyforge import live_compile as live
from policyforge.api import app
from policyforge.compiler import check_source_grounding
from policyforge.detectors import create_default_invariant_registry
from policyforge.engine import PolicyEngine
from policyforge.models import Event, FindingType, Rule
from policyforge.scenarios import validate_scenario
from policyforge.shrink import get_finding_signature, is_valid_journey, shrink_journey

ROOT = Path(__file__).resolve().parents[1]
CASES: list[dict[str, Any]] = json.loads(
    (ROOT / "tests/fixtures/advanced_live/policy_cases.json").read_text(encoding="utf-8")
)
CHECKS = [(case, check) for case in CASES for check in case["checks"]]
CLIENT_CLASS = live.BoundedCompileClient
ACCESS = "offline-advanced-workspace-code-only"
SECRET = "offline-advanced-provider-placeholder"


def rules_for(case: dict[str, Any]) -> list[Rule]:
    return live.PolicyEnvelope.model_validate_json(json.dumps({"rules": case["rules"]})).rules


@pytest.mark.parametrize("case,check", CHECKS, ids=[f"{c['id']}-{s['id']}" for c, s in CHECKS])
def test_expected_decisions_and_findings(case: dict[str, Any], check: dict[str, Any]) -> None:
    rules = rules_for(case)
    for rule in rules:
        assert rule.source.doc_name == "policy.md"
        assert rule.source.verbatim_sentence in case["document_text"]
        assert check_source_grounding(rule.source.verbatim_sentence, case["document_text"])
    assert validate_scenario(check["journey"]) == (True, None)
    journey = [Event.model_validate(e) for e in check["journey"]]
    assert is_valid_journey(journey)
    engine = PolicyEngine(rules, invariant_registry=create_default_invariant_registry())
    result = engine.run(journey)
    assert result.model_dump(mode="json") == engine.run(journey).model_dump(mode="json")
    outcome = result.outcomes[-1]
    assert outcome.outcome.value == check["outcome"]
    assert outcome.resolution_type == check["resolution"]
    assert [f.type.value for f in outcome.findings] == check["final_findings"]
    for finding in result.findings:
        assert finding.trace and finding.event_indices
        assert finding.severity.value


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_mock_compile_consumes_one_attempt_even_on_rejection(
    case: dict[str, Any], monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    # Only this isolated test process is enabled, with fake values and MockTransport.
    for key, value in {
        "POLICYFORGE_ENABLE_LIVE_AI": "true", "POLICYFORGE_AI_REQUEST_BUDGET": "1",
        "POLICYFORGE_COMPILE_TOKEN": ACCESS, "NEBIUS_API_KEY": SECRET,
        "NEBIUS_MODEL": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        "NEBIUS_BASE_URL": "https://api.tokenfactory.nebius.com/v1/",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(live, "gate", live.CompileGate())
    calls: list[httpx.Request] = []
    clients: list[live.BoundedCompileClient] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={
            "id": "offline", "object": "chat.completion", "created": 0,
            "model": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
            "choices": [{"index": 0, "finish_reason": "stop", "message": {
                "role": "assistant", "content": json.dumps({"rules": case["rules"]}),
            }}],
        })

    def make_client() -> live.BoundedCompileClient:
        client = CLIENT_CLASS(httpx.MockTransport(handle))
        clients.append(client)
        return client

    monkeypatch.setattr(live, "BoundedCompileClient", make_client)
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {ACCESS}", "Idempotency-Key": str(uuid4())}
    payload = {"document_text": case["document_text"], "doc_name": "policy.md", "live": True}
    response = client.post("/api/compile", headers=headers, json=payload)
    assert response.status_code == (200 if case["rules"] else 422)
    assert response.json().get("provider_requests", response.json().get("detail", {}).get("provider_requests")) == 1
    if case["rules"]:
        assert response.json()["compiled_rules"] == [r.model_dump(mode="json") for r in rules_for(case)]
        assert all(item["grounded"] for item in response.json()["rule_confidence"].values())
    # Replays and a different policy cannot reset this process's accepted-attempt budget.
    assert client.post("/api/compile", headers=headers, json=payload).status_code == 409
    blocked = client.post("/api/compile", headers={**headers, "Idempotency-Key": str(uuid4())},
                          json={**payload, "document_text": "A different policy."})
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "budget_limit"
    assert len(calls) == len(clients) == 1
    body = json.loads(calls[0].content)
    assert body["model"] == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
    assert body["max_tokens"] == 1536 and body["n"] == 1 and body["stream"] is False
    assert set(calls[0].extensions["timeout"].values()) == {30.0}
    assert clients[0].max_retries == clients[0].sdk.max_retries == 0
    assert SECRET not in response.text + caplog.text
    assert ACCESS not in response.text + caplog.text


def test_ambiguous_fixture_is_rejected_not_replaced_with_a_guess() -> None:
    case = next(c for c in CASES if c["id"] == "ADV-05")
    assert case["rules"] == case["checks"] == []
    with pytest.raises(ValidationError):
        rules_for(case)


def test_explicit_precedence_resolves_real_overlap() -> None:
    case = next(c for c in CASES if c["id"] == "ADV-04")
    rules = rules_for(case)
    check = next(s for s in case["checks"] if s["id"] == "final_sale_29")
    journey = [Event.model_validate(e) for e in check["journey"]]
    resolved = PolicyEngine(rules).run(journey)
    assert not resolved.findings
    assert resolved.outcomes[-1].resolution_type == "OVERRIDE_DENY"
    # This mutation is an offline control, never a repair to real model output.
    without_precedence = copy.deepcopy(rules)
    without_precedence[1].overrides = []
    conflicting = PolicyEngine(without_precedence).run(journey)
    assert [f.type for f in conflicting.findings] == [FindingType.CONTRADICTION]


def test_saved_counterexample_replays_with_same_signature_and_trace() -> None:
    evidence = json.loads((ROOT / "docs/ADVANCED_OFFLINE_PREFLIGHT.json").read_text(encoding="utf-8"))
    case = next(c for c in CASES if c["id"] == "ADV-06")
    engine = PolicyEngine(rules_for(case), invariant_registry=create_default_invariant_registry())
    witness = evidence["complex_counterexample"]
    original = [Event.model_validate(e) for e in witness["original_journey"]]
    finding = next(f for f in engine.run(original).findings if f.type == FindingType.CONTRADICTION)
    shrunk = shrink_journey(engine, original, get_finding_signature(finding))
    assert is_valid_journey(shrunk.minimal_journey)
    assert [e.model_dump(mode="json") for e in shrunk.minimal_journey] == witness["minimal_journey"]
    replay = engine.run(shrunk.minimal_journey)
    assert replay.model_dump(mode="json") == witness["replay"]
    assert any(get_finding_signature(f) == get_finding_signature(finding) for f in replay.findings)


@pytest.mark.parametrize("journey", [
    [{"event_type": "ARBITRARY_ACTION", "day": 0}],
    [{"event_type": "REFUND_REQUESTED", "day": 1, "payload": {"invented_field": True}}],
    [{"event_type": "ITEM_DELIVERED", "day": 2}, {"event_type": "REFUND_REQUESTED", "day": 1}],
    [{"event_type": "REFUND_REQUESTED", "day": -1}],
])
def test_adversarial_candidates_still_require_local_validation(journey: list[dict[str, Any]]) -> None:
    assert validate_scenario(journey)[0] is False


def test_live_tracker_contains_no_fabricated_results() -> None:
    tracker = json.loads((ROOT / "docs/ADVANCED_LIVE_RESULTS.json").read_text(encoding="utf-8"))
    assert tracker["live_provider_requests_this_phase"] == 0
    assert [item["test_id"] for item in tracker["results"]] == [c["id"] for c in CASES]
    for actual, expected in zip(tracker["results"], CASES):
        assert actual["input_policy"] == expected["document_text"]
        assert actual["expected_output"]["rules"] == expected["rules"]
        assert actual["status"] in {"PASS", "FAIL", "NEEDS REVIEW"}
        assert actual["execution"] in {"NOT_RUN", "COMPLETED"}
        if actual["execution"] == "NOT_RUN":
            assert actual["status"] == "NEEDS REVIEW"
            for field in ("actual_output", "pydantic_validation", "grounding_validation", "semantic_correctness",
                          "deterministic_simulation_result", "provider_request_count", "input_tokens",
                          "output_tokens", "reasoning_tokens", "estimated_cost_usd", "http_status",
                          "model_used", "finish_reason", "request_id"):
                assert actual[field] is None
        else:
            assert actual["actual_output"] is not None
            assert actual["provider_request_count"] in {0, 1, None}
