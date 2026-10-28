"""Loopback-only browser test harness. Never use as a deployment entry point.

It replaces provider HTTP with MockTransport and blocks real HTTPX transports.
Run: python -m uvicorn browser_mock_api:app --app-dir tests --host 127.0.0.1 --port 8010
"""
import json
import os
import time
from pathlib import Path
from typing import Any
import httpx

# Override inherited real configuration before importing the application loader.
os.environ.update({"NEBIUS_API_KEY":"offline-browser-test-only-no-real-credential",
    "NEBIUS_MODEL":"nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    "NEBIUS_BASE_URL":"https://api.tokenfactory.nebius.com/v1/",
    "POLICYFORGE_ENABLE_LIVE_AI":"true", "POLICYFORGE_COMPILE_TOKEN":"offline-browser-workspace-access-only",
    "POLICYFORGE_AI_REQUEST_BUDGET":"10",
    "POLICYFORGE_CORS_ORIGINS":"http://127.0.0.1:3001,http://localhost:3001"})

from policyforge.api import app
from policyforge import live_compile as live

stats: dict[str, Any] = {"mock_provider_requests":0}
client_class = live.BoundedCompileClient
fixture = json.loads((Path(__file__).parent / "fixtures/nebius_smoke/valid_policy_ir.json").read_text())


def mock_provider(request: httpx.Request) -> httpx.Response:
    stats["mock_provider_requests"] += 1
    prompt = json.loads(request.content)["messages"][1]["content"]
    text = prompt.split("Clause [whole_document]: ", 1)[1].split("\n\nExtract any business", 1)[0]
    data = json.loads(json.dumps(fixture))
    data["rules"][0]["source"] = {"doc_name":"policy.md", "verbatim_sentence":text}
    if "[offline-invalid]" in text:
        data["rules"][0]["when"] = {"days_since_delivery":{"op":"LTE","value":30}}
    if "[offline-slow]" in text:
        time.sleep(3)
    return httpx.Response(200, json={"id":"offline-browser","object":"chat.completion","created":0,
        "model":"nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B","choices":[{"index":0,"finish_reason":"stop",
        "message":{"role":"assistant","content":json.dumps(data)}}],
        "usage":{"prompt_tokens":120,"completion_tokens":100,"total_tokens":220}})


def blocked(*args: Any, **kwargs: Any) -> Any:
    raise AssertionError("Real provider HTTP is prohibited in the browser harness.")


httpx.HTTPTransport.handle_request = blocked
async def blocked_async(*args: Any, **kwargs: Any) -> Any:
    raise AssertionError("Real async provider HTTP is prohibited in the browser harness.")
httpx.AsyncHTTPTransport.handle_async_request = blocked_async
live.BoundedCompileClient = lambda: client_class(httpx.MockTransport(mock_provider))  # type: ignore[misc,assignment]


@app.get("/__offline__/stats")
def mock_stats() -> dict[str, Any]:
    return stats
