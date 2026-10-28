"""Offline tests must never use the real provider HTTP transport."""

from typing import Any

import httpx
import pytest


@pytest.fixture(autouse=True)
def prohibit_provider_network(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep MockTransport/TestClient usable; explicit live tests remain opt-in."""
    if request.node.get_closest_marker("live") is not None:
        return

    def blocked(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("Real HTTP transport is forbidden in offline tests.")

    async def blocked_async(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("Real HTTP transport is forbidden in offline tests.")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", blocked_async)
