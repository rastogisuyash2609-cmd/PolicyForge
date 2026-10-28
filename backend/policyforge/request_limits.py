"""Bound request memory before FastAPI decodes JSON. No provider interaction."""
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send, Message


class RequestBodyLimit:
    def __init__(self, app: ASGIApp, max_bytes: int = 1_000_000) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] in ("GET", "OPTIONS"):
            await self.app(scope, receive, send)
            return
        limit = 16_384 if scope["path"] == "/api/compile" else self.max_bytes
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                await JSONResponse(status_code=413, content={"detail": {
                    "code": "body_limit", "message": "Request body exceeds the endpoint limit. No inference was performed."
                }})(scope, receive, send)
                return
            if not message.get("more_body", False):
                break
        delivered = False
        async def replay() -> Message:
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}
        await self.app(scope, replay, send)
