# Deployment preparation — not deployed

Phase 9A clears the six identified frontend dependency findings. The refreshed
full and production npm audits and Python audits report zero known vulnerabilities;
see [PHASE9A.md](PHASE9A.md) and its saved audit evidence. Next.js is pinned to
15.5.28, with its PostCSS dependency overridden to the already-used 8.5.30.
This removes the identified dependency release blocker, not the public-service
authentication, durable quota, TLS and ingress prerequisites below. Nothing has
been pushed, merged, deployed or publicly bound.

## Local frontend and backend

Use Node.js with the checked-in npm lockfile, and Python 3.11. From the project root:

Phase 9A was verified on Windows with Node.js 22.19.0 and npm 10.9.3. The frontend
still has its existing Windows-only direct SWC dependency (now aligned to Next.js).
For Linux hosting, remove that redundant direct dependency and let Next.js install
its platform-specific optional SWC package, then validate a clean install/build on
the target platform. Linux deployment has not been verified. Python manifests pin
direct dependencies; transitive versions can change on a fresh install, so audit
the actual release environment as well.

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& .\.venv\Scripts\python.exe -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
```

Run Next.js separately from `frontend/`:

```powershell
npm ci
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

NEXT_PUBLIC_API_URL is public and build-time; changing it requires rebuilding the
frontend. It is an API origin, never a credential. Production browsers require
an HTTPS API URL compatible with the site's HTTPS origin. Never serve development
servers publicly. The verified existing local Python environment is documented in
BACKEND_CONFIGURATION.md; the requirements files record its installed versions.

## Backend-only secrets and opt-in

Root `.env` remains Git-ignored. No real key or access code was added/changed in
this phase. Copy variable names from `.env.example`; configure values manually:

| Variable | Purpose / safe default |
| --- | --- |
| NEBIUS_API_KEY | Real provider credential, backend only |
| NEBIUS_MODEL | nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B |
| NEBIUS_BASE_URL | Approved HTTPS Nebius /v1 endpoint |
| POLICYFORGE_ENABLE_LIVE_AI | false by default; true only after a deliberate owner decision |
| POLICYFORGE_COMPILE_TOKEN | Separate high-entropy workspace access code, at least 24 characters; never reuse NEBIUS_API_KEY |
| POLICYFORGE_AI_REQUEST_BUDGET | 3 attempts per backend process by default; clamped to 1..10 |
| POLICYFORGE_CORS_ORIGINS | Exact frontend origins; defaults localhost:3000 and 127.0.0.1:3000; no wildcard |
| MAX_RETRIES | 0; the guarded API independently forces zero retries |

Set secrets through the host's secret manager/environment for hosted deployment,
not in Docker images, frontend env files, NEXT_PUBLIC variables, repository files,
logs or request URLs. On local startup python-dotenv loads this checkout's root
`.env` with inherited environment variables taking precedence. Restart the backend
after changing configuration. Never print `.env` or enable provider debug logs.

The owner supplies authorized operators only the separate workspace access code.
The browser holds it in memory and sends it in the Authorization header over TLS;
it is not persisted in drafts, active policies, reports or browser storage. It is
an application credential visible to its authorized operator, not a provider key.
Do not enter the Nebius key in the UI. Treat shared access-code distribution as
operator-only access; it is not per-user identity, revocation or enterprise SSO.

## API safeguards and public access

Live POST /api/compile requires server feature opt-in, explicit live:true, a valid
Bearer access code, and a fresh UUID Idempotency-Key. One request handles the entire
document; documents batches, nonzero max_repairs and arbitrary extra settings are
rejected. Limits: 4000 policy characters, 8 rules, 1536 output tokens, 30-second
per-operation provider timeout, one provider POST, zero retries/repairs/fallbacks.
The frontend waits up to 40 seconds for the bounded backend operation.

Gate limits: one active compilation globally per worker, two attempts per minute,
the configured session hard budget, repeated request IDs blocked for the process
lifetime, and identical policy content blocked for five minutes. Accepted attempts
consume budget before provider work; failures never restore it. Failures report
sanitized codes and returned usage where available. Timeouts may still be billed.
The transport accepts only the configured provider inference URL and no redirects.

Request bodies are buffered with a 16 KiB cap for compile and 1 MB for other POST
routes. Place a reverse proxy with corresponding ingress/header/body/time limits
and rate/concurrency limits in front of ALL routes, including deterministic suites
and fixture mode, to protect CPU as well as credits. CORS is not authentication.
Allowlist origins; do not forward or trust arbitrary user-supplied proxy headers.

**Single worker, one instance only for this guarded operator demo.** Budgets and
idempotency are in memory: restarting resets them, and multiple workers/instances
would multiply them. Before multi-instance or anonymous public use, add a shared
durable quota/idempotency store, authenticated user identities, per-user limits,
TLS, gateway abuse controls and a provider-account spending limit. Never present
the process gate as a shared-account $29.50 balance cap. It cannot track teammate
usage, provider-internal execution, or external CLI calls. No balance is inferred.

Keep live mode OFF for public demonstrations unless only authorized operators can
reach the live path. The fixture/manual deterministic experience needs no provider
credentials and remains available with live compilation disabled.

## Validation and release checklist

Run backend pytest (default excludes live), frontend unit and local API integration
tests, typecheck, lint, build, secret scans, full and production npm audits, and
pip-audit for the deployed Python environment. Repeat audits at release time;
Phase 9A results are a dated advisory-database snapshot. Use the test-only browser harness for mocked
Compile → review → activate → stress/What-if → report checks. Never deploy
`tests/browser_mock_api.py` or include its test-only stats route in production.

Production source entry points are `policyforge.api:app` and `next start`.
Frontend/backend health and CORS checks do not require inference. Deploy only after
an explicitly authorized release decision and successful dependency remediation.
