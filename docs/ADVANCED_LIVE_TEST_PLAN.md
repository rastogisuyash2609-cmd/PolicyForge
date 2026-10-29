# Advanced NVIDIA extraction tests — Phase 9C extension

Future authorized tests must opt into the durable local receipt recorder described
in [COMPILATION_EVIDENCE.md](COMPILATION_EVIDENCE.md). ADV-01's historical status
remains UNCONFIRMED; the recorder cannot reconstruct it. Preserve real/mock mode,
actual IR and usage from the new receipt rather than inferring them from HTTP 200.

Prepared on 2026-10-29 from **HEAD 96e7076**, whose parent is **886e090**.
Preparation only: **zero live provider requests**, no live enablement, no deployment.
The existing root .env, backend/frontend processes and application code are unchanged.

## Evidence and scope

Only the simple inclusive 30-day refund category has real Nemotron success evidence:
the third CLI smoke test and the owner-performed Phase 9B frontend test. Its exact
frontend usage/billing are still unavailable/pending. Do not repeat that test.
Every case below is **synthetic/offline**, not a recorded provider result or a live PASS.
The two-rule combined and three-rule complex documents include a refund clause to
test its interaction with other clauses; neither is a repeated standalone refund test.

Source of truth: models.py, compiler.py, live_compile.py, engine.py, scenarios.py,
shrink.py and the Phase 9B/9C and Stage 2 documents. No schema, prompt, deterministic
engine, frontend, dependency or production integration change was needed.

- Complete expected IR and journeys: `tests/fixtures/advanced_live/policy_cases.json`.
- Actual live results ledger: `docs/ADVANCED_LIVE_RESULTS.json`.
- Observed offline engine results, size estimates, full trace and reduced replay:
  `docs/ADVANCED_OFFLINE_PREFLIGHT.json`.
- Regression tests: `tests/test_advanced_live_preparation.py`.

## Shared schema and acceptance contract

The provider envelope is `{"rules":[...]}`. Rule requires `id`, `name`, `decision`,
`trigger`, `when`, `effect`, `source`. Source requires `doc_name` and
`verbatim_sentence`. Optional defaults are priority=0, overrides=[], state_updates=null.
The API validates 1–8 rules and unique IDs, then returns them as `compiled_rules`.
Fixture IDs/names are illustrative; real IDs may differ but must be unique and
override references must point to the correct real rule ID. Do not compare names
or ordering as a proxy for meaning.

Leaves use explicit `{"field":"days_since_delivery","op":"LTE","value":14}`;
groups are `{"all":[...]}` (AND) or `{"any":[...]}` (OR), recursively nested.
Dynamic field-name keys, mixed group/leaf shapes and unsupported enums fail.
Used fields are days_since_delivery, item_damaged, replacement_cancelled and
is_final_sale; used operators are LTE, LT and IS_TRUE. Only REFUND and REPLACEMENT
are decision domains. Triggers here are REFUND_REQUESTED or REPLACEMENT_REQUESTED;
effects are ALLOW or DENY. There is no general CANCEL decision or free-form action.

For the actual Analyze UI, **doc_name is policy.md**, regardless of display name.
Each source quote must reproduce its corresponding input clause. The existing
grounding checker normalizes case/whitespace and checks substring membership;
manual review should require the correct complete clause, including qualifications.
All fixture quotes are exact substrings. Schema plus grounding cannot prove
semantic completeness or prevent invented meaning with an authentic quote.

For unambiguous cases, require HTTP success, finish_reason=stop, exactly one provider
request, local Pydantic PASS, every rule grounded, no omissions/inventions, and the
expected deterministic checks. A necessary delivery-state guard is acceptable;
an extra business qualification is not. No rule here should introduce state_updates,
automatic payments, restocking fees, customer tiers or exceptions absent from input.
Bounds, same-day behavior and effects must survive semantic review. Do not silently
repair a real output to match the fixture.

**FAIL:** truncation, unsupported/malformed IR, wrong event/domain/effect, wrong
boundary, lost AND condition, bad quote/document, duplicate ID, invented precedence
or additional requests. Missing telemetry remains unavailable, not zero. A timeout
may still be billed. Stop on failure; no automatic follow-up. Preserve the previous
active revision. Review a draft before activation; after switching live OFF, the
deterministic simulation/stress/reports workflow uses the chosen active revision.

## ADV-01 — replacement eligibility (first candidate)

Exact input:

> Customers may request a replacement within 14 days of delivery when the item is damaged.

Expected: one REPLACEMENT / REPLACEMENT_REQUESTED / ALLOW rule with
`all(item_damaged IS_TRUE true, days_since_delivery LTE 14)`. Source quotes the whole
sentence in policy.md. No refund rule, OR substitution or unstated denial rule.

PASS: damaged item on days 0 and 14 ALLOW; undamaged day 14 and damaged day 15
DEFAULT_DENY with POLICY_GAP. FAIL if damage is optional, deadline is LT 14, the
window changes, or a different decision/event is used. These fixtures model
eligibility on a recorded damage fact; they do not assess evidence of damage.

## ADV-02 — cancellation conditions

Exact input:

> Customers may request a refund after a replacement has been cancelled.

Expected: one REFUND / REFUND_REQUESTED / ALLOW rule with
`replacement_cancelled IS_TRUE true`, exact whole-sentence source in policy.md.
No numeric deadline is justified. The trigger remains the refund request, not
the cancellation event. Cancellation does not itself complete or pay a refund.

PASS: delivery → replacement request → replacement cancellation → refund request
allows the final refund; without cancellation it defaults DENY/POLICY_GAP.
FAIL: invented deadline, order-cancellation substitution, automatic refund or
unconditional entitlement. This is **replacement cancellation**, not arbitrary
order cancellation. Only this cancellation-conditioned refund rule is extracted.
Consequently the earlier replacement request itself has no supporting rule and
produces a separate POLICY_GAP. The fixture checks the final refund result and
records that earlier gap; it does not claim approval of the earlier replacement.
The engine trusts the recorded cancellation transition and does not verify its
real-world authorization. The journey validator checks a prior request exists,
not that it was approved. A broader fulfillment lifecycle is outside this test.

## ADV-03 — combined refund and replacement

Exact input (two lines):

```text
Customers may request a refund within 30 days of delivery.
Customers may request a replacement within 14 days of delivery.
```

Expected: two ALLOW rules, REFUND_REQUESTED / REFUND / LTE 30 and
REPLACEMENT_REQUESTED / REPLACEMENT / LTE 14 on days_since_delivery. Each quotes
its own complete sentence in policy.md; priority=0 and no invented overrides.

PASS: refund day 30 ALLOW/day 31 DEFAULT_DENY; replacement day 14 ALLOW/day 15
DEFAULT_DENY. Independent day-10 refund and replacement journeys each ALLOW
without CONTRADICTION. These are different decisions/triggers: overlapping
eligibility alone is not contradictory. FAIL: omitted rule, swapped windows,
conflated domains or invented mutual exclusion. Eligibility does not assert that
both a refund and a replacement have completed; completion invariants are separate.

## ADV-04 — strict boundary and explicit precedence

Exact input:

```text
Refund requests are allowed less than 30 days after delivery.
Final-sale refund requests are denied; this rule overrides the refund-window rule.
```

Expected: a refund ALLOW leaf `days_since_delivery LT 30`; a refund DENY leaf
`is_final_sale IS_TRUE true`. Both trigger REFUND_REQUESTED. DENY.overrides must
reference the ALLOW rule's actual ID. Each rule quotes its full corresponding
line, including the override statement for the DENY rule. Do not invent numeric
priorities to replace this explicit override relationship.

PASS: non-final-sale days 0/29 ALLOW, days 30/31 DEFAULT_DENY/POLICY_GAP; final-sale
day 29 OVERRIDE_DENY, day 30 UNANIMOUS_DENY. No contradiction for this declared
precedence. FAIL: LTE 30, missing/dangling/reversed override, a mutual override
cycle, missing denial or treating this resolved overlap as a contradiction.
Offline control: removing the override makes the day-29 opposing rules yield
CONTRADICTION. This control is never applied to real model output as a repair.

## ADV-05 — ambiguous language

Exact input:

> Refunds may be available within a reasonable time.

No numeric window or unconditional entitlement is justified. Expected safe result:
rejection or explicit need for human clarification, with no activated fabricated
rule. The current extraction prompt allows an empty rules envelope, but the live
API rejects it locally with HTTP 422 because it requires at least one rule. This
is a **safe semantic PASS for the ambiguous test**, not a successful compilation.
The fixture is `{"rules":[]}` and intentionally fails PolicyEnvelope validation.

There is no dedicated clarification response channel in the existing UI/API.
If the model instead emits explanatory prose it also fails JSON validation; record
that honestly as format failure/NEEDS REVIEW, not proof it understood ambiguity.
No deterministic business-policy behavior can be established from this input.
Do not simulate an empty policy and call default DENY an extracted interpretation.
A schema-valid, source-grounded invented 30-day or unconditional ALLOW rule is
**FAIL** in manual semantic review. Generic schema/grounding checks cannot ensure
this automatically. No additional request to ask the model to clarify is authorized.

## ADV-06 — complex overlap, real contradiction and uncovered region

Exact input (four lines, three business rules):

```text
Customers may request a refund within 30 days of delivery.
Customers may request a replacement within 14 days of delivery when the item is damaged.
Refund requests within 14 days of delivery are denied when the item is damaged.
All rules have priority 0 and no overrides.
```

Expected: refund ALLOW LTE 30; damaged replacement ALLOW with AND/LTE 14;
damaged refund DENY with AND/LTE 14. Each rule quotes its corresponding business
sentence in policy.md; global priority=0/no overrides applies to all three.
No specificity-based precedence is implemented or permitted by this explicit text.

PASS: damaged refund day 10 and day 14 fires the opposing refund rules, giving
CONTRADICTION/HIGH with both refund rule IDs, event index and deterministic trace;
the engine resolves DENY. Damaged refund day 15 and undamaged refund day 10 ALLOW.
Damaged replacement day 10 ALLOW, with no cross-domain contradiction. Damaged
replacement day 15 and refund day 31 DEFAULT_DENY/POLICY_GAP: these are uncovered
regions under current engine semantics, not invented denial clauses or proof the
merchant intended permission there. FAIL: missing rule, fabricated override,
different priority, OR qualification or a contradiction asserted merely because
refund and replacement eligibility overlap.

Observed offline witness: ORDER_PLACED@0 → ITEM_DELIVERED@0 → damaged
REFUND_REQUESTED@10. Existing shrinker reduces it in 9 engine runs to
ITEM_DELIVERED@0 → REFUND_REQUESTED@0(payload item_damaged=true). Replay retains
CONTRADICTION with fixture IDs deny_damaged_refund/refund_window and a full trace.
Day 0 is intentionally within both inclusive windows. This is a domain-valid,
1-minimal deterministic replay under the current shrinker, not an AI-generated
scenario or a guarantee of global minimality.

## Adversarial generation availability

**No wired real Nemotron adversarial scenario generator exists.** scenarios.py
contains deterministic boundary/pattern generators, validate_scenario and run_suite.
The API exposes those deterministic/custom suites; it has no model-driven scenario
generation endpoint. LLMClient and a validator alone do not establish this capability.
No paid generation test or new AI-generation feature was implemented.

The ADV-06 authored witness is an offline adversarial candidate with reproducible
validation, engine execution, shrinking and replay. Existing validation rejects
unknown events/fields, decreasing/negative days and selected invalid payload types;
Pydantic Event rejects extra event keys; is_valid_journey additionally requires a
prior replacement request for cancellation. These are not exhaustive causal/type
checks: some payload values are Any and Python bool is an int for some checks.
Future generation would need a separately scoped implementation, validation plan,
one-request guard and fresh approval; none is claimed live-ready here.

## Token fit, costs and shared reserve

Keep **nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B**, max_tokens=1536, timeout=30 seconds,
SDK/wrapper/HTTP retries=0, compiler repairs=0, fallback=0, one request per invocation.
The transport timeout is 30 seconds per network operation, not a guaranteed total
wall-clock deadline. Existing json_object parameters and reasoning behavior remain
unchanged; do not add unverified reasoning controls or JSON Schema parameters.

| Case | Compact expected JSON characters | Rough JSON-only tokens (characters / 4 to / 3) |
| --- | ---: | ---: |
| ADV-01 | 410 | 103–137 |
| ADV-02 | 331 | 83–111 |
| ADV-03 | 608 | 152–203 |
| ADV-04 | 653 | 164–218 |
| ADV-05 (empty envelope only) | 12 | 3–4 |
| ADV-06 | 1083 | 271–361 |

These are **heuristics, not Nemotron tokenizer measurements or usage**. They exclude
reasoning, expanded names, formatting and optional delivery guards. The full
compiler system prompt is 2237 characters before user policy/framing. Expected
compact JSON is plausibly within 1536 for every case, including the three-rule
case, with the complex case carrying more truncation risk. Real reasoning may use
the remaining budget; prior single-rule output was 621 tokens. No fit guarantee,
automatic cap increase or 2048-token change is justified by these fixtures. Stop
and review any length response, never spend another request to repair it.

Public list prices checked on 2026-10-29: **$0.06 per million input tokens and
$0.24 per million output tokens** for Nano, from the official
[Nebius Nemotron model page](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference).
The indexed official page supplied the prices; direct fetch/catalog access was
unavailable. No authenticated provider/model-list/billing request was made.

Cost formula in USD: `(input_tokens * 0.06 + output_tokens * 0.24) / 1_000_000`.
At the 1536 output cap the output component is **$0.00036864**. An illustrative
1024–2048 input tokens plus the full output cap gives **$0.00043008–$0.00049152**
for one request. This is a planning allowance for each case, not measured usage,
an actual charge or a hard total ceiling: input token count is not yet known.
No aggregate live batch is scheduled or authorized. Actual costs remain null.

The initial shared $29.50 and previous dashboard snapshot are historical,
owner-reported evidence. Current usable balance, teammate spending, credit expiry,
discounts/taxes and the pending frontend charge were not independently verified.
Before **each** future approval, the owner must confirm usable balance and ensure
the proposed maximum allowance leaves **at least $20.50**, including concurrent
shared-account spending. If that cannot be established, do not execute. Software
does not enforce an account-dollar reserve.

The existing accepted-attempt budget is **per process**. Keep budget=1 and exactly
one backend worker, no reload. Failure consumes the reservation. Duplicate UUID/
content guards and a one-active-request gate also apply. Do not restart live
workers to bypass exhaustion. After one attempt shut live mode OFF; any later
case requires a new explicit authorization and fresh budget/balance review, not
an automatic restart. Persistent quotas/account-wide spending controls remain a
production blocker for unrestricted public live AI (see PHASE9D_DEPLOYMENT.md).

## Results tracking

ADVANCED_LIVE_RESULTS.json records each ID/category/input, expected complete IR and
checks, actual output, Pydantic/grounding/semantic status, deterministic simulation,
request count, input/output/reasoning tokens, estimated cost and PASS/FAIL/NEEDS REVIEW.
All actual fields are **null**, execution=NOT_RUN, status=NEEDS REVIEW. Preparation
provider count is separately 0. Do not copy mock usage or offline traces into live
actual fields. Save only sanitized response fields; never headers, workspace code,
provider key or raw provider diagnostics. Record missing usage as unavailable;
the prior frontend request remains pending. For ambiguity annotate the distinction
between safe rejection and compilation success explicitly.

## Offline verification and reproduction

Run from the project root with the existing Python 3.11 runtime:

```powershell
.\docs\reproduce_advanced_preflight.ps1
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m pytest tests -q
```

The reproduction script blocks socket connections and runs only local fixture
validation/engine/shrink operations. It records **6 cases, 25 deterministic checks,
0 network attempts, 0 provider requests**. All five nonempty expected IR envelopes
pass Pydantic/grounding; the ambiguous empty envelope is rejected as expected.
The 39 added tests exercise those decisions, safe ambiguous rejection, one mocked
attempt per case, no validation repairs, exhausted budget/deduplication, 1536/30s/
zero-retry settings, no secret echoes, precedence controls, invalid adversarial
candidates, replay and the absence of fabricated live results.

Full backend: **279 passed, 0 failed, 1 live test deselected**. The initial restricted
shell run stalled after the 25 engine checks and was interrupted; rerunning outside
that shell passed all 39 new tests, then the full suite. Default pytest guards
block real HTTPX transports; inference-shaped tests use MockTransport and fixture
credentials only. Enabling flags inside monkeypatched tests does not enable the
running backend or edit .env. No frontend source changed, so frontend/build/audit
work was not repeated; the Phase 9C results remain the prior baseline, not new runs.

Current backend /api/health and frontend Analyze GET: **200**. A deliberately
unauthenticated compile gate probe returned **503/live_disabled**, before any SDK
creation/reservation. Root .env remains unchanged, Git-ignored/untracked, live=false,
budget=1; required backend credentials and separate workspace code are configured
without displaying values. Configured-credential exposure checks covered **339
files**, including the new artifacts and existing frontend source/build/public
assets, with **0 matches**; see ADVANCED_SECURITY_PREFLIGHT.json. No Compile click,
smoke CLI, benchmark or live request.

## First additional live test — instructions only, not authorized/executed

1. Owner verifies current usable shared credit/expiry, pending usage and $20.50
   reserve, then explicitly authorizes **ADV-01, one request only**. No approval
   is implied for ADV-02–06. Codex can manage the terminal/process steps after that
   approval; the owner does not need to open an IDE.
2. Stop only the verified PolicyForge backend via Ctrl+C in its owning terminal;
   confirm port 8000 is free. Do not start parallel/reload workers or touch frontend.
   Leave .env live=false and unchanged. In the backend shell, only after approval:

   ```powershell
   Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
   $env:PYTHONPATH = Join-Path (Get-Location) 'backend'
   $env:POLICYFORGE_ENABLE_LIVE_AI = 'true'
   $env:POLICYFORGE_AI_REQUEST_BUDGET = '1'
   $env:POLICYFORGE_LIVE_TEST_ID = 'ADV-01'
   & 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
   ```

3. Verify GET http://127.0.0.1:8000/api/health returns 200. Open
   http://127.0.0.1:3000/workspace/analyze without restarting the frontend. Enter
   display name **ADV-01 Damaged replacement**, paste the exact ADV-01 sentence,
   enter only the separate workspace access code, check consent and click
   **Compile with NVIDIA once**. No typing/page-load inference is permitted.
   Do not use the fixed refund smoke CLI for these arbitrary documents.
4. Do not resend, edit while pending, launch another client or proceed to another
   case. Capture the response JSON's safe fields (not request headers): model,
   request_id, finish_reason, provider_requests, token_usage, compiled_rules and
   rule_confidence, or sanitized error. Apply ADV-01 acceptance criteria. Stop
   on any failure, including length. Do not increase the cap or retry.
5. After that one response (success or failure), Ctrl+C the backend and restart
   live-disabled in that same shell; do not reload the browser/destroy its draft:

   ```powershell
   $env:POLICYFORGE_ENABLE_LIVE_AI = 'false'
   & 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
   ```

6. Verify health and disabled gate, inspect the saved local receipt using the
   read-only commands in COMPILATION_EVIDENCE.md, update only the new attempt's
   sanitized live record (retain the earlier UNCONFIRMED evidence),
   then review/activate only a semantically valid draft. Run its deterministic
   boundary journeys with live OFF and record findings/revision/replay. A backend
   restart to disable AI does not clear the frontend's in-memory session. Stop and
   report; no second paid attempt, batch, next phase, push, merge or deployment.
