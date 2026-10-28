# Phase 7C — controlled live smoke test preparation

**No additional live Nebius API request has been made during Phase 7C.** The first
approved test exhausted its old 512-token budget and failed safely. This is a CLI
runner, independent of FastAPI and the frontend. Do not execute its live flag
until the user explicitly approves the test.

Module: `backend/policyforge/nebius_smoke.py`

## Fixed operation and limits

- Synthetic input only: `Customers may request a refund within 30 days of delivery.`
- Existing PolicyCompiler and existing Pydantic Rule IR; one clause and one rule.
- Output limit: **1536 tokens**, sent as `max_tokens=1536` (including any provider
  reasoning tokens charged against that cap). One non-streaming completion.
- SDK/HTTP timeout: **30 seconds**. HTTPX timeouts are per network operation,
  not a promise of an exact wall-clock deadline or of zero cost on a timeout.
- SDK retries **0**, wrapper retries **0**, compiler repairs **0**, underlying
  transport connection retries **0**, redirects disabled, environment proxies disabled.
- A lock-protected HTTP transport permits only one POST to the configured
  `/v1/chat/completions` URL. The attempt is consumed **before** sending; a timeout,
  4xx/5xx, invalid response or validation failure never restores the budget.
- A separate client invocation guard rejects a second compiler/model call even
  after malformed JSON or schema failure. No model discovery, JSON-correction
  requests, scenario generation, benchmarks, agents, background jobs or follow-ups.

The budget is **one attempt per explicit CLI invocation**, not a global account
quota. Re-running the command is another operation and requires a new decision;
there is no automatic rerun/resume after failure. Provider-internal execution and
billing after a client timeout remain outside the client's control.

## Why a dedicated adapter is needed

The general LLMClient has no output-token-cap argument, while the general
compiler defaults to two repair attempts and can process multiple clauses.
The new `SingleRequestClient` implements the existing LLMClient interface with a
guarded SDK transport, while calling the existing compiler with `max_repairs=0`.
The shared client, compiler, deterministic algorithms, routes and frontend were
not modified for this step.

The response must first pass a local Pydantic envelope containing exactly one
existing Rule. The existing compiler then performs local source grounding,
Rule validation and lint. JSON/Pydantic errors are returned without input echoes
or exception context. Invalid schema, truncation, refusal, empty output and
missing grounding fail the test without another inference attempt. Lint warnings
are reported separately; successful IR validation is not a correctness guarantee.

## Credentials, telemetry and safe defaults

The existing backend environment loader reads the Git-ignored root `.env`.
The runner requires all three explicit Nebius settings and an approved HTTPS
Nebius endpoint/NVIDIA Nemotron model ID. It does not fall back to an OpenAI key
or a mock compiler if Nebius credentials are missing.

The configured model is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. The first approved
test established authentication/model access; Phase 7C checks configuration locally
and performs no model-list or other Nebius API request. Reasoning remains at the
provider default: no model-specific Nebius thinking toggle was verified. See
[the diagnosis and pricing assumptions](NEBIUS_TRUNCATION_FIX.md).

No credential argument is accepted. Keys use SecretStr internally, are excluded
from configuration repr/results, and are never placed in prompts or report fields.
SDK/HTTP logging is suppressed during execution. Raw SDK exception messages,
HTTP bodies and provider response text are not returned; unexpected key echoes in
validated fields or errors are redacted. Unknown CLI arguments are not echoed.

The report includes configured model, status, validation, limits, attempted request
count, validated rules or sanitized errors, completion finish reason and provider
token usage when returned. It also reports a numeric reasoning-token count if the
provider supplies `completion_tokens_details.reasoning_tokens`, plus visible-output
character count. It never returns reasoning text. Missing usage or reasoning counts
are `null`, not zero. A failed/timeout
attempt may still have incurred provider cost; no inference-cost claim is made
without reliable usage and current pricing. No report is automatically uploaded
or persisted.

## Local-only preflight (safe during preparation)

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.nebius_smoke
```

Expected status: `prepared_live_disabled`, validation `not_run`, request count 0.
Imports, `--help` and preflight do not construct an SDK client or contact Nebius.

## Execute only after explicit user approval

**The following command is prepared, not executed:**

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.nebius_smoke --execute-one-request
```

The runner reads the current root `.env` in its own process. No backend restart,
frontend action or `/api/compile` HTTP request is necessary. Stop after its single
result even on failure; do not retry without a new explicit decision. Exit code
0 means successful validation (or default preflight); 1 means a failed check;
2 means invalid CLI arguments. Read the JSON status to distinguish preflight
from a completed live result.

## Offline verification

`tests/test_nebius_smoke.py` uses only HTTPX MockTransport and an autouse fixture
that forbids the real HTTP transport. No real credentials are used in those tests.
Coverage includes default-off CLI, explicit opt-in with injected offline transport,
caps/timeouts/repair settings, real compiler and Rule validation, malformed JSON,
unsupported IR, empty/multiple rules, grounding failure, HTTP failures/rate limits,
redirects, timeout budget consumption, missing usage, truncation, duplicate calls,
concurrent attempts, missing credentials, unsafe endpoints and secret redaction.

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m pytest -q tests/test_nebius_smoke.py
```

Normal pytest retains `-m "not live"` by default. Do not use `pytest -m live` or
the old PONG integration test as a substitute: those do not enforce this runner's
bounded single-clause extraction contract.

Phase 7C results (2026-10-29): **43 offline smoke tests passed**; full backend
regression **164 passed, 1 deselected** (the live-provider test). The existing
API compile test is included with `use_mock=True`. `tests/conftest.py` blocks real
synchronous/asynchronous HTTPX transports for every non-live test, even when a
real key is configured. Frontend regression: **58 passed**.

Run the full offline backend suite with:

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m pytest tests -q
```

Default CLI preflight confirmed configuration present, status
`prepared_live_disabled`, validation `not_run`, request count **0**, cap **1536**,
token usage `null`. Root `.env` remains Git-ignored. Zero additional provider
requests or paid calls occurred. The revised cap/prompt have not been live-tested;
another inference still requires explicit approval.
