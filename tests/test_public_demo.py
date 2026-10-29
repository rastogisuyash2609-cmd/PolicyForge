"""Offline public release boundaries, including concurrency and no inference."""
import asyncio
import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from policyforge.api import app
from policyforge.public_demo import PublicDemoGuard, validate_workload


@pytest.fixture
def public_client(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("POLICYFORGE_CORS_ORIGINS", "https://judges.example")
    with TestClient(PublicDemoGuard(app, enabled=True)) as client:
        yield client


@pytest.mark.parametrize("origin", ["", "*", "http://localhost:3000", "https://user:secret@host", "https://host/path", "https://host?query=x"])
def test_public_cors_fails_closed(monkeypatch: pytest.MonkeyPatch, origin: str) -> None:
    monkeypatch.setenv("POLICYFORGE_CORS_ORIGINS", origin)
    with pytest.raises(RuntimeError, match="exact HTTPS"):
        PublicDemoGuard(app, enabled=True)


@pytest.mark.parametrize("payload", [{"live": True}, {"use_mock": True}, {}])
@pytest.mark.parametrize("path", ["/api/compile", "/api/compile/"])
def test_public_compile_never_reaches_provider(public_client: TestClient, monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any], path: str) -> None:
    def forbidden(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("Compiler must not run in public mode")
    monkeypatch.setattr("policyforge.api.compile_live", forbidden)
    monkeypatch.setenv("POLICYFORGE_ENABLE_LIVE_AI", "true")  # Guard wins even over accidental opt-in.
    response = public_client.post(path, json=payload)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "live_disabled"


@pytest.mark.parametrize("payload", [
    {"rules": [{}] * 101}, {"rules_v2": [{}] * 101},
    {"journey": [{}] * 51}, {"custom_scenarios": [{}] * 201},
    {"custom_scenarios": [{"journey": [{}] * 51}]},
    {"limit": 0}, {"limit": -1}, {"limit": None}, {"limit": 201}, {"limit": True},
    {"rules": [{"when": {"field": "days_since_delivery", "value": i}} for i in range(33)]},
])
def test_excess_work_rejected_before_schema(public_client: TestClient, payload: dict[str, Any]) -> None:
    response = public_client.post("/api/run-suite", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "demo_work_limit"


def test_condition_depth_and_total_nodes_are_bounded() -> None:
    condition: dict[str, Any] = {"field": "days_since_delivery", "op": "LTE", "value": 30}
    for _ in range(8):
        condition = {"all": [condition]}
    with pytest.raises(ValueError, match="condition limit"):
        validate_workload({"rules": [{"when": condition}]}, "/api/simulate")
    with pytest.raises(ValueError, match="condition limit"):
        validate_workload({"rules": [{"when": {"all": [{}] * 2048}}]}, "/api/simulate")


def test_malformed_deep_and_nonfinite_json_rejected(public_client: TestClient) -> None:
    bodies = [b"{", b"[", b'{"x":' + b"[" * 1500 + b"0" + b"]" * 1500 + b"}", b'{"x":NaN}']
    for body in bodies:
        assert public_client.post("/api/simulate", content=body).status_code == 422
    assert public_client.post("/api/simulate", content=b"x" * 1_000_001).status_code == 413


def test_existing_demo_suite_diff_shrink_and_boundaries(public_client: TestClient) -> None:
    data = public_client.get("/api/default-data").json()
    rules = data["rules_v1"]
    journey = data["sample_journeys"][0]["journey"]
    simulation = public_client.post("/api/simulate", json={"rules": rules, "journey": journey})
    assert simulation.status_code == 200
    assert public_client.post("/api/shrink", json={"rules": rules, "journey": journey}).status_code == 200
    assert public_client.post("/api/run-suite", json={"rules": rules, "limit": 5}).status_code == 200
    assert public_client.post("/api/diff", json={"rules_v1": rules, "rules_v2": data["rules_v2"], "limit": 5}).status_code == 200


def test_rate_expiry_health_and_untrusted_forwarding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLICYFORGE_CORS_ORIGINS", "https://judges.example")
    now = [0.0]
    guarded = PublicDemoGuard(app, enabled=True, clock=lambda: now[0])
    with TestClient(guarded) as client:
        for i in range(30):
            assert client.post("/api/simulate", json={}, headers={"X-Forwarded-For": f"192.0.2.{i}"}).status_code == 422
        response = client.post("/api/simulate", json={})
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        for _ in range(121):
            assert client.get("/api/health").status_code == 200
        now[0] = 60
        assert client.post("/api/simulate", json={}).status_code == 422
        for _ in range(120):
            assert client.get("/api/default-data").status_code == 200
        assert client.get("/api/default-data").status_code == 429


def test_concurrency_release_on_exception_and_cancellation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLICYFORGE_CORS_ORIGINS", "https://judges.example")

    async def exercise() -> None:
        started = 0
        both_started = asyncio.Event()
        finish = asyncio.Event()

        async def blocking(scope: Any, receive: Any, send: Any) -> None:
            nonlocal started
            started += 1
            if started == 2:
                both_started.set()
            await finish.wait()
            raise RuntimeError("synthetic failure")

        guard = PublicDemoGuard(blocking, enabled=True)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=guard), base_url="http://test") as client:
            first = asyncio.create_task(client.post("/api/simulate", json={}))
            second = asyncio.create_task(client.post("/api/simulate", json={}))
            await asyncio.wait_for(both_started.wait(), 2)
            assert (await client.post("/api/simulate", json={})).status_code == 429
            first.cancel()
            with pytest.raises(asyncio.CancelledError):
                await first
            assert guard.active == 1
            finish.set()
            with pytest.raises(RuntimeError, match="synthetic failure"):
                await second
            assert guard.active == 0
    asyncio.run(exercise())


def test_local_mode_unchanged_and_cors_errors_wrapped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POLICYFORGE_PUBLIC_DEMO", raising=False)
    assert PublicDemoGuard(app).enabled is False
    # Actual production middleware order keeps CORS outside guard responses.
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    fixture = FastAPI()
    monkeypatch.setenv("POLICYFORGE_CORS_ORIGINS", "https://judges.example")
    fixture.add_middleware(PublicDemoGuard)
    monkeypatch.setenv("POLICYFORGE_PUBLIC_DEMO", "true")
    fixture.add_middleware(CORSMiddleware, allow_origins=["https://judges.example"])
    with TestClient(fixture) as client:
        response = client.post("/api/compile", json={}, headers={"Origin": "https://judges.example"})
        assert response.status_code == 503
        assert response.headers["access-control-allow-origin"] == "https://judges.example"
        assert "access-control-allow-origin" not in client.post("/api/compile", json={}, headers={"Origin": "https://other.example"}).headers
