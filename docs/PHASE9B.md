# Phase 9B, Step A: offline preparation for one frontend inference

Prepared on 2026-10-29 from fc07278. **Step A only: zero additional live Nebius
requests or paid inference.** No enabling of live mode, credential generation,
credential edits, frontend Compile action against Nebius, benchmark, push, merge,
deployment or Phase 9C. The root .env was never printed or modified.

## Readiness and inspection

Read AGENTS.md, PHASE8.md, PHASE9A.md, STAGE2_POLICY_CASES.md and DEPLOYMENT.md.
Inspected backend api.py, llm.py, live_compile.py, provider_safety.py, compiler.py
and models.py; frontend AnalyzeScreen, workspace/active-policy state, API transport
and response contracts, use-policy-compilation, comparison/stress/report paths;
existing live_compile, nebius_smoke and Stage 2 tests and their fixtures.

The existing Analyze -> FastAPI -> bounded SDK -> Pydantic -> grounding -> draft
review -> activation path is ready for one local operator session after manual
configuration and separate Step B authorization. Deterministic analysis reuses the
active revision. Nothing needs rebuilding. No critical production-code blocker was
found, so application functionality and dependencies were left unchanged.

Only tests/test_live_compile.py and documentation changed: six additional offline
test cases verify wrong workspace credentials, rejection of a workspace code equal
to the provider key, and a one-attempt API session after both success and validation
failure. The new-policy test advances beyond rate/content cooldowns and uses a new
UUID, so the hard budget itself must stop the second attempt.

Configuration inspection returned booleans only: root .env exists and is ignored;
the provider key is present, the exact Nano model and approved .com /v1 endpoint
match, live mode is OFF, the separate workspace code is unset, and budget=1 is not
yet configured (existing default is 3). Prior real credential/model success is
historical; no fresh provider authentication, access or balance check occurred.

## Exact manual local configuration

Backend directory: `C:\Users\Suyash Rastogi\PolicyForge\backend`.
Environment file: **`C:\Users\Suyash Rastogi\PolicyForge\.env`**.
python-dotenv loads this exact file at import, with inherited environment taking
precedence (override=False). Settings require a backend restart, not a browser
reload. The current backend process explicitly remains live-disabled.

Set/check the following manually in the root .env; do not share its contents:

| Variable | Required local value/action |
| --- | --- |
| NEBIUS_API_KEY | Leave the existing real value unchanged; never enter it in the frontend. |
| NEBIUS_MODEL | nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B |
| NEBIUS_BASE_URL | https://api.tokenfactory.nebius.com/v1/ |
| POLICYFORGE_COMPILE_TOKEN | Manually create a separate random ASCII workspace code; recommend at least 32 characters (server minimum 24). Do not reuse the provider key. No value was generated or printed by this phase. |
| POLICYFORGE_AI_REQUEST_BUDGET | **1** for the first UI test session. |
| POLICYFORGE_ENABLE_LIVE_AI | **false** in the file; retain the safe default. Only the explicitly authorized Step B process temporarily overrides it to true. |
| MAX_RETRIES | 0; guarded compile independently forces zero retries. |
| REQUEST_TIMEOUT_SECONDS | 30.0; guarded compile independently fixes its provider timeout to 30 seconds per operation. |
| POLICYFORGE_CORS_ORIGINS | http://localhost:3000,http://127.0.0.1:3000 |

Frontend URL: **http://127.0.0.1:3000/workspace/analyze**.
The existing production build already uses API origin http://127.0.0.1:8000.
No frontend configuration change/build is necessary. If rebuilt later, set only
the public `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`; never put either credential
in frontend env files, NEXT_PUBLIC variables or bundled JavaScript. Enter the
workspace code manually into the UI's password field during the authorized test.
It is an authorized operator's application credential, held only in React memory
and sent to local FastAPI in a Bearer header; it is never the Nebius key.

Do not enable Step B merely because the workspace code and budget are configured.
Separate explicit authorization is still required.

## Security, request and credit controls

- Server authorization checks feature opt-in, valid distinct workspace token, then
  input/UUID/configuration before a provider client can run. Invalid/missing code
  fails closed; the provider key cannot authenticate as the workspace code.
- The frontend requests `POST /api/compile` only inside the explicit Compile
  handler, after policy name/text, code and per-request consent. It sends live:true,
  max_repairs:0, doc_name:policy.md, a new UUID Idempotency-Key and Bearer header.
  Consent resets before request dispatch. No compile on load, typing, navigation,
  checkbox changes, health, frontend build or background timers. Fixture loading
  and deterministic routes do not invoke the model.
- One provider POST, Nano model, 1536 output-token limit, n=1, no streaming,
  30-second per-operation timeout. Zero SDK/wrapper/transport retries, zero compiler
  repairs, zero fallback calls, no scenario-generation model calls. Provider URL
  is allowlisted; redirects/proxies disabled. Frontend timeout is 40 seconds.
- One concurrent compilation per process; two attempts/minute; budget=1 supplies
  the stricter session cap. The gate consumes an accepted attempt on failure too.
  Request IDs stay blocked for the process lifetime; identical content is blocked
  for five minutes. New content/UUID after cooldown still cannot bypass budget=1.
- Double-click protection plus abort/stale response guards preserve previous draft
  and active rules. Validation is local Pydantic/raw condition validation plus
  source grounding/lint. Incomplete JSON, unsupported schema, refusal and truncation
  fail without another request. Human review remains necessary for policy meaning.
- One worker/instance, loopback only, **no --reload** for Step B. The session gate
  resets on restart and does not cover teammates, other processes, CLI smoke tests,
  provider billing or other account usage. Do not restart live-enabled to obtain
  another attempt. Never run the CLI smoke execution or a benchmark alongside it.
- A $20.50 reserve cannot be guaranteed from the $29.50 historical starting credit.
  Actual usable balance, expiry, teammate usage, account limits and billing were
  not verified. Before Step B the owner must manually check valid available credits,
  coordinate account usage and keep at least the requested reserve plus the test's
  cost allowance. No spending from the theoretical $9 difference is authorized.
  Stop if the reserve/validity cannot be confirmed.

## Pricing and sanitized usage record

The [official Nebius Nano listing](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference)
lists **$0.06 per million input tokens and $0.24 per million output tokens**.
The public indexed listing was checked on 2026-10-29; the direct page reader was
unavailable. This is a published list-price estimate, not verified account pricing
or a promise of credit validity. No authenticated provider endpoint was contacted.

At 1536 output tokens the output component is $0.00036864. With an illustrative
2048 input tokens the one-request estimate is **$0.00049152** (about $0.0005).
This is not a hard total-cost ceiling: the SDK does not cap input tokens at 2048,
the prompt adds schema text and exact tokenizer counts are unknown until returned.
The chosen policy is only 58 characters; do not substitute a long document.

Use actual returned usage to record:
`estimated_usd = (prompt_tokens * 0.06 + completion_tokens * 0.24) / 1000000`.
Do not add reasoning tokens twice if already included in completion_tokens. Missing
usage remains unknown, not zero; a timed-out attempt may still be billed. Reconfirm
published/account rates before treating this as an actual billing estimate.

Existing successful API responses expose sanitized model, request_id,
provider_requests and token_usage.call_count/provider_usage, including prompt_tokens,
completion_tokens and total_tokens. The reviewed active revision's report retains
that provenance. Errors return sanitized detail.code, provider_requests and any
returned usage. SDK/debug logs are suppressed; no new raw request logger or billing
service was added. There is no durable account ledger or automatic dollar estimate
in the UI. Record the following fields in the Step B completion report from the
response (all currently **not run**, rather than fabricated values):

| Field to record after the single attempt | Source |
| --- | --- |
| Model, request UUID, HTTP status | Response body/status |
| Provider request count | provider_requests; should be 1 if a send occurred, 0 for local preflight denial |
| Input/output/total tokens | token_usage.provider_usage on success, or detail.token_usage.provider_usage on failure |
| finish_reason | Successful response body; expect stop |
| Pydantic/grounding outcome, reviewed rule and active revision | Compiled response, review panel and activation identity |
| Estimated USD, pricing source/date | Actual returned counts and the formula above; unknown if counts absent |
| Sanitized failure code | detail.code; never raw provider bodies or credentials |

Copy only these response fields. Do not export request headers, Copy-as-cURL, HAR
files, screenshots of access-code entry or environment dumps; those can expose the
workspace credential. Do not log policy prompts or provider credentials.

## Selected first policy and expected complete IR

Policy name: `UI refund test 1` (display label only).
Policy text, exactly:

> Customers may request a refund within 30 days of delivery.

The model's rule ID/name can differ; meaning must not. This complete valid
reference uses the current schema and the UI's source document name:

```json
{
  "rules": [{
    "id": "refund_30_days",
    "name": "Refund within 30 days",
    "decision": "REFUND",
    "trigger": "REFUND_REQUESTED",
    "when": {"all": [
      {"field": "item_delivered", "op": "IS_TRUE", "value": true},
      {"field": "days_since_delivery", "op": "LTE", "value": 30}
    ]},
    "effect": "ALLOW",
    "priority": 0,
    "overrides": [],
    "state_updates": null,
    "source": {
      "doc_name": "policy.md",
      "verbatim_sentence": "Customers may request a refund within 30 days of delivery."
    }
  }]
}
```

The provider envelope has rules; the frontend-facing FastAPI response instead
exposes the validated list as compiled_rules plus usage/grounding metadata. A leaf
days_since_delivery LTE 30 without the delivery guard is also semantically valid
for the existing derived-field engine. Require exactly one refund rule, valid
explicit field/op/value leaves, correct enums, grounded source, inclusive day 30,
no invented deadline/exceptions/overrides or state-changing actions. Day 31's DENY
is the engine default, not an extracted explicit denial obligation. Complete
response / finish_reason=stop, Pydantic pass and every rule grounded=true are
necessary before semantic review and activation. Do not activate on any failure.

The remaining five candidates, exact texts, failure criteria and expected
grounding/validation are prepared in STAGE2_POLICY_CASES.md. None is authorized
for live execution by Step A or by the future first-test procedure below.

## Step B runbook — prepared only, NOT executed

1. Obtain explicit authorization for **one provider inference through the UI**.
   Manually verify usable balance/credit expiry and preserve the $20.50 reserve.
   Manually set the separate code and budget=1 in root .env; leave file live flag
   false and the existing provider key unchanged. Close other test/CLI sessions.
2. Stop the existing backend using Ctrl+C in its owning terminal. Confirm port
   8000 is no longer listening before starting a replacement; do not run a second
   instance. In a dedicated PowerShell terminal, after that authorization only:

   ```powershell
   Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
   $env:PYTHONPATH = Join-Path (Get-Location) 'backend'
   $env:POLICYFORGE_ENABLE_LIVE_AI = 'true'
   $env:POLICYFORGE_AI_REQUEST_BUDGET = '1'
   & 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
   ```

   Do not add --reload, more workers or alternative secret values. Inherited
   configuration overrides .env; use a fresh dedicated shell with no stale secret
   overrides. Do not print environment variables. A health GET needs no inference.
3. Open http://127.0.0.1:3000/workspace/analyze. Keep the existing frontend on 3000;
   do not use the isolated browser mock ports 3001/8010 for the real test. Clear
   only the draft if needed (active rules remain), enter the name and exact text
   above, then manually enter the workspace code. Never enter the Nebius key.
4. If using browser developer tools, open Network and filter `/api/compile` before
   clicking. Do not expose request Authorization headers. Check consent and click
   **Compile with NVIDIA exactly once**. CORS OPTIONS is not a provider inference;
   the single POST response carries provider_requests. Do not refresh, edit input
   while pending, resend, change policy, run the smoke CLI or retry on failure.
5. Inspect the **Response JSON only** and the UI's draft rule review: HTTP status,
   model, finish_reason, provider_requests, token_usage, compiled_rules,
   rule_confidence and rejected/unmapped arrays. Expected: one request, stop,
   nonempty Pydantic-valid IR, grounded true, no rejection/unmapped entries. Stop
   immediately on truncation, schema/grounding/auth/rate/timeout/credit failure;
   do not attempt repairs, a fallback or another request. Record safe fields above.
6. After the one response (success or failure), Ctrl+C the backend and restart it
   with live mode OFF before any further UI actions:

   ```powershell
   $env:POLICYFORGE_ENABLE_LIVE_AI = 'false'
   & 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
   ```

   Do not reload the browser, which would clear its transient draft. Switching the
   backend off does not affect that draft. Any request still executing may have
   been billed; stopping/cancelling is not a refund or authorization to retry.
7. If and only if the response passes semantic review, click Activate rules once.
   Confirm AI origin and the new revision; inspect Policies. Deterministic day
   0/30/31 simulations, Stress Testing, Reports and What-if can then run without
   paid inference using that active revision. Keep further Compile actions off.
   Produce the sanitized single-attempt report and stop; no second case or Phase
   9C is authorized. Another paid request always needs fresh approval.

## Offline preflight evidence

- Actual GET /api/health at 8000 and GET Analyze at 3000: **200**. Actual
  unauthenticated compile gate probe: **503/live_disabled**, before SDK setup.
- Actual in-app Analyze screen inspected: fixtures loaded, NovaCart v1 active,
  separate access-code field and consent checkbox, Compile disabled; no click.
- Targeted backend: **92 passed** across test_live_compile.py,
  test_stage2_policies.py and test_nebius_smoke.py, including six new budget/auth
  cases. Default offline test fixture blocks real sync/async HTTPX transport.
- Targeted frontend: **38 passed** across compilation, policy-workspace,
  comparison and advanced-features tests (mocked fetch and deterministic fixtures).
  Correct API body/headers, one fetch, no retries, activation/provenance, stale
  responses, active preservation, Stress/Reports/What-if contracts pass.
- No frontend source/dependency/build change. Reuse the unchanged production build
  and same-day Phase 9A browser compile/review/activate/stress/report/What-if plus
  invalid/stale preservation evidence; those were 3 mocked attempts and 0 real
  calls. Full suites/build/lint/audits were already green in Phase 9A and were not
  repeated unnecessarily. No failed test was skipped.
- Root .env is Git-ignored/untracked. Configured credentials are not in built
  assets: the refreshed scan covered **135 build/public files, 292 total files**,
  with zero configured-credential matches. No frontend provider-key env reads.
  The complete IR example above was independently validated using the actual
  PolicyEnvelope Pydantic model, source grounding and engine journeys: day 0 ALLOW,
  day 30 ALLOW, day 31 DENY. SDK and workspace credentials are never included in
  committed changes or usage records.

Readiness blockers for paid execution: manual workspace-code setup, budget=1,
explicit Step B approval and manual valid-credit/reserve verification. No real UI
inference has been performed; this is preparation, not proof of live API quality.
Public deployment prerequisites from DEPLOYMENT.md still apply separately.
