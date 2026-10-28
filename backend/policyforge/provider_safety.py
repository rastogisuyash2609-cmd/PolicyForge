"""Shared bounded-provider configuration and transport; no inference on import."""
from contextlib import contextmanager
from dataclasses import dataclass, field
import logging
import os
import re
from threading import Lock
from typing import Iterator
from urllib.parse import urlsplit
import httpx
from pydantic import SecretStr

MAX_OUTPUT_TOKENS = 1536
TIMEOUT_SECONDS = 30.0
MAX_PROVIDER_REQUESTS = 1
ALLOWED_HOSTS = frozenset({
    "api.tokenfactory.nebius.com", "api.tokenfactory.nebius.ai",
    "api.studio.nebius.ai", "api.tokenfactory.us-central1.nebius.com",
})


class SmokeGuardError(RuntimeError):
    """A fixed-message local safety failure; never embeds request details."""


@dataclass(frozen=True)
class SmokeConfiguration:
    model: str
    base_url: str
    api_key: SecretStr = field(repr=False)

    def __post_init__(self) -> None:
        if not self.api_key.get_secret_value().strip():
            raise SmokeGuardError("NEBIUS_API_KEY is missing or empty.")
        if not re.fullmatch(r"nvidia/[A-Za-z0-9_.-]+", self.model) or "nemotron" not in self.model.lower():
            raise SmokeGuardError("Configure an explicit NVIDIA Nemotron model.")
        url = urlsplit(self.base_url)
        if (url.scheme != "https" or url.hostname not in ALLOWED_HOSTS
                or url.port not in (None, 443) or url.path.rstrip("/") != "/v1"
                or url.username or url.password or url.query or url.fragment):
            raise SmokeGuardError("Configure an approved HTTPS Nebius /v1 endpoint.")


def read_configuration() -> SmokeConfiguration:
    """The existing LLM module loads root .env; no OpenAI credential fallback here."""
    return SmokeConfiguration(
        model=os.getenv("NEBIUS_MODEL", "").strip(),
        base_url=os.getenv("NEBIUS_BASE_URL", "").strip(),
        api_key=SecretStr(os.getenv("NEBIUS_API_KEY", "")),
    )


class OneRequestTransport(httpx.BaseTransport):
    """Consume the only attempt before sending, including failed/timeout attempts."""

    def __init__(self, endpoint: str, inner: httpx.BaseTransport) -> None:
        self._endpoint = httpx.URL(endpoint.rstrip("/") + "/chat/completions")
        self._inner = inner
        self._lock = Lock()
        self.attempts = 0

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        with self._lock:
            if request.method != "POST" or request.url != self._endpoint:
                raise SmokeGuardError("Only the configured inference endpoint is allowed.")
            if self.attempts >= MAX_PROVIDER_REQUESTS:
                raise SmokeGuardError("The single provider request budget is exhausted.")
            self.attempts += 1
        return self._inner.handle_request(request)

    def close(self) -> None:
        self._inner.close()


@contextmanager
def quiet_provider_logs() -> Iterator[None]:
    """Suppress SDK/HTTP debug logs during this synchronous CLI operation only."""
    previous = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        yield
    finally:
        logging.disable(previous)
