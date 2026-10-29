# Phase 9B: first real frontend compilation result

Completed locally on 2026-10-29. **Result: successful compilation using the existing
Analyze Policy frontend and NVIDIA Nemotron integration.** Exact frontend-request
token usage and billing are **unavailable/pending**, not zero. No additional
inference was performed to reconstruct missing telemetry. No Phase 9C was started.

## Available evidence and result

The owner explicitly reported manually clicking Compile with NVIDIA once and
seeing one valid refund rule, Validation passed, days_since_delivery LTE 30,
effect ALLOW, and correct source evidence. Codex inspected the old backend session
logs without displaying raw log output or credentials: **one POST /api/compile,
HTTP 200**, with **zero warning/error lines** in that log output.

The selected test policy was:

> Customers may request a refund within 30 days of delivery.

| Item | Result / evidence |
| --- | --- |
| Configured model | nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B |
| Frontend compilation | PASS, owner-reported validated UI result and successful backend request log |
| FastAPI response | HTTP 200 for the single completed compile POST |
| Pydantic Policy IR validation | PASS; the successful live endpoint validates the rules envelope and individual IR before returning, consistent with the owner's UI observation |
| Source grounding | PASS; required by the successful endpoint path and explicitly confirmed by the owner in the UI |
| Reviewed rule | One refund ALLOW rule with explicit condition field=days_since_delivery, op=LTE, value=30 |
| Interpretation | Inclusive 30-day refund window; no new live semantic/boundary tests were run to reconfirm it |
| Complete response / finish reason | A successful endpoint response requires finish_reason=stop and no refusal. This follows from the guarded success path; the raw response itself was not retained for inspection |
| Provider inference requests | 1 for the owner's completed frontend test, supported by one successful compile POST and the existing one-request transport; provider billing for this request is not yet available |
| Input tokens for frontend request | **Unavailable/pending** |
| Output tokens for frontend request | **Unavailable/pending** |
| Total tokens for frontend request | **Unavailable/pending** |
| Reasoning tokens for frontend request | **Unavailable**; no count was recovered or inferred |
| Exact charge / request-specific cost estimate | **Unavailable/pending**; no counts were invented or borrowed from earlier tests |
| Additional inference by Codex during shutdown/reporting | **0** |

The complete generated IR, exact model-generated ID/name, response UUID and raw
response body were not recovered; none is invented here. The condition/effect above
are the owner's observed rule summary, not a fabricated full Policy IR envelope.
The first three CLI tests' counts must never be attributed to this frontend test.

## Usage and billing: historical dashboard snapshot only

The owner reported checking the official Nebius Token Factory billing dashboard
and supplied the following snapshot. Codex did not sign in to the dashboard or
independently query account/billing APIs.

| Owner-reported dashboard field | Value | Attribution |
| --- | --- | --- |
| Displayed account balance | $29.50 | Dashboard snapshot reported by owner; not a newly inferred remaining balance |
| Input tokens | 1304 | First three Python smoke tests only |
| Output tokens | 2384 | First three Python smoke tests only |
| Total tokens | 3688 | First three Python smoke tests only |
| Total listed cost | $0.00065040 | First three Python smoke tests only |
| Latest frontend compilation | Not yet included, according to owner | Exact usage and billing pending |

These totals agree arithmetically with the previously reported three CLI tests:
input 637 + 221 + 446 = 1304; output 512 + 1251 + 621 = 2384;
1304 + 2384 = 3688. This consistency is not a measurement of the frontend request.

Do not subtract the historical cost from the rounded displayed balance to claim
a new exact balance, a zero-cost frontend request or a guaranteed $20.50 reserve.
Pending settlement, account display precision, teammate usage and credit expiry
remain outside the local application's process budget. No balance/credit validity
was independently verified by Codex. No further paid test is authorized to fill
the telemetry gap. Update this record only from the original response or a later
owner-supplied billing observation; do not replay the compilation.

## Shutdown, health and session preservation

- Identified the verified live-enabled loopback Uvicorn process, PID 10676, and
  stopped only that backend process after the owner reported completion.
- Restarted exactly once as PID 40900 with temporary process overrides
  POLICYFORGE_ENABLE_LIVE_AI=false and POLICYFORGE_AI_REQUEST_BUDGET=1, one worker,
  no reload, listening on 127.0.0.1:8000.
- GET /api/health returned **200**. An empty unauthenticated local compile probe
  returned **503/live_disabled** at the first authorization gate, before provider
  client creation; it made **zero** provider requests. This is a disabled-gate
  verification, not a second policy compilation or paid test.
- At report finalization, the same disabled backend process remained on port 8000
  and health again returned 200. No subsequent restart or live enable occurred.
- Root .env was not edited. Its POLICYFORGE_ENABLE_LIVE_AI=false remains intact.
  Both credentials remained undisclosed. No unrelated source or configuration
  files were modified.
- Frontend process PID 15336 stayed running. Codex did not restart the frontend,
  reload or navigate browser pages, edit rules, activate a policy, or trigger
  Stress Testing/What-if/Reports during shutdown and reporting.
- The accessible in-app tab contained an empty draft rather than the owner's
  completed test. Other browser sessions were not accessible. The original
  completed response/usage could therefore not be recovered through browser
  inspection. The owner's test tab was left untouched; its retained draft or
  activation state was not independently verified.

## Scope and closeout

Prior offline preparation remains documented in PHASE9B.md: 92 targeted backend
tests and 38 targeted frontend tests passed; the one-attempt budget, authorization,
zero retries/repairs/fallbacks, 1536 output cap, 30-second per-operation timeout,
Pydantic validation and grounding guards were verified. Those safeguards were not
changed for the manual live test. Only report documentation changed during this
closeout; no additional test suite/build was necessary or executed.

Phase 9B's first live frontend extraction is recorded as **successful, with usage
and billing pending**. This is evidence for one simple policy, not all six Stage 2
cases or an activated end-to-end deterministic run with the new live rule. The
existing mocked activation/stress/comparison/report evidence is separate.

Live AI remains disabled. No further provider requests, smoke runs, benchmark,
automatic follow-up, push, merge or deployment occurred during shutdown and
reporting. This report contains only sanitized evidence and owner-supplied billing
figures. Any future paid test requires new explicit authorization.
