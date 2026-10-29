"""Opt-in, inference-free public demo boundary; engine semantics stay unchanged."""
from __future__ import annotations

from collections import deque
import json
import math
import os
import time
from typing import Any, Callable
from urllib.parse import urlsplit

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


def validate_workload(data: Any, path: str) -> None:
    """Reject excessive work before recursive Pydantic decoding or generation."""
    if not isinstance(data, dict):
        raise ValueError("object required")
    stack: list[tuple[Any, int]] = [(data, 0)]
    nodes = 0
    while stack:
        value, depth = stack.pop()
        nodes += 1
        if depth > 32 or nodes > 50_000:
            raise ValueError("JSON complexity limit")
        if isinstance(value, dict):
            stack.extend((child, depth + 1) for child in value.values())
        elif isinstance(value, list):
            stack.extend((child, depth + 1) for child in value)
        elif isinstance(value, float) and not math.isfinite(value):
            raise ValueError("nonfinite number")

    condition_nodes = 0
    thresholds: set[int] = set()
    for name in ("rules", "rules_v1", "rules_v2"):
        rules = data.get(name, [])
        if not isinstance(rules, list) or len(rules) > 100:
            raise ValueError("rule limit")
        for rule in rules:
            if not isinstance(rule, dict):
                raise ValueError("rule object required")
            conditions: list[tuple[Any, int]] = [(rule.get("when"), 1)]
            while conditions:
                condition, depth = conditions.pop()
                condition_nodes += 1
                if depth > 8 or condition_nodes > 2_048:
                    raise ValueError("condition limit")
                if not isinstance(condition, dict):
                    continue  # The existing schema rejects malformed conditions.
                for key in ("all", "any"):
                    children = condition.get(key)
                    if isinstance(children, list):
                        conditions.extend((child, depth + 1) for child in children)
                threshold = condition.get("value")
                if condition.get("field") == "days_since_delivery" and isinstance(threshold, (int, float)):
                    thresholds.add(int(threshold))
                    if len(thresholds) > 32:
                        raise ValueError("boundary generation limit")

    def journey_limit(journey: Any) -> None:
        if not isinstance(journey, list) or len(journey) > 50:
            raise ValueError("journey limit")

    if "journey" in data:
        journey_limit(data["journey"])
    scenarios = data.get("custom_scenarios")
    if scenarios is not None:
        if not isinstance(scenarios, list) or len(scenarios) > 200:
            raise ValueError("scenario limit")
        for scenario in scenarios:
            if not isinstance(scenario, dict):
                raise ValueError("scenario object required")
            journey_limit(scenario.get("journey", []))
    if path in ("/api/run-suite", "/api/diff"):
        limit = data.get("limit", 30)
        if type(limit) is not int or not 1 <= limit <= 200:
            raise ValueError("execution limit")


class PublicDemoGuard:
    """Global per-worker limits; deliberately no spoofable client-IP accounting.

    One event loop owns this state. Admission precedes the first await; finally
    releases the slot on success, failure or cancellation. This is not a durable
    quota or a substitute for a hosting provider's network/DDoS protection.
    """

    def __init__(self, app: ASGIApp, *, enabled: bool | None = None,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.app = app
        self.enabled = (os.getenv("POLICYFORGE_PUBLIC_DEMO", "false").lower() == "true"
                        if enabled is None else enabled)
        self.clock = clock
        self.reads: deque[float] = deque()
        self.writes: deque[float] = deque()
        self.active = 0
        if self.enabled:
            origins = os.getenv("POLICYFORGE_CORS_ORIGINS", "").split(",")
            for origin in origins:
                parsed = urlsplit(origin.strip())
                if (parsed.scheme != "https" or not parsed.hostname or parsed.username
                        or parsed.password or parsed.path or parsed.query or parsed.fragment):
                    raise RuntimeError("Public demo requires exact HTTPS CORS origins.")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (not self.enabled or scope["type"] != "http"
                or scope["method"] == "OPTIONS" or scope["path"] == "/api/health"):
            await self.app(scope, receive, send)
            return

        async def reject(status: int, code: str, message: str) -> None:
            headers = {"Retry-After": "60"} if status == 429 else None
            await JSONResponse(status_code=status, headers=headers,
                               content={"detail": {"code": code, "message": message}})(scope, receive, send)

        if scope["path"].rstrip("/") == "/api/compile":
            await reject(503, "live_disabled", "Compilation is disabled on the public demo. Use Demo Policy or manual rules.")
            return
        write = scope["method"] not in ("GET", "HEAD")
        recent = self.writes if write else self.reads
        now = self.clock()
        while recent and now - recent[0] >= 60:
            recent.popleft()
        if len(recent) >= (30 if write else 120):
            await reject(429, "demo_rate_limit", "Public demo request limit reached. Wait before trying again.")
            return
        recent.append(now)
        if write and self.active >= 2:
            await reject(429, "demo_busy", "Public demo is busy. Wait before trying again.")
            return
        if not write:
            await self.app(scope, receive, send)
            return

        self.active += 1
        try:
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > 1_000_000:
                    await reject(413, "body_limit", "Public demo request body is too large.")
                    return
                if not message.get("more_body", False):
                    break
            try:
                validate_workload(json.loads(body), scope["path"].rstrip("/"))
            except (ValueError, TypeError, RecursionError, OverflowError):
                await reject(422, "demo_work_limit", "Invalid or excessive workload. Use at most 100 rules per revision, 50 events per journey, 200 scenarios, 32 day thresholds and 8 condition levels.")
                return
            delivered = False

            async def replay() -> Message:
                nonlocal delivered
                if delivered:
                    return await receive()
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}

            await self.app(scope, replay, send)
        finally:
            self.active -= 1
