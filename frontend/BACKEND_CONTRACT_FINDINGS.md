# Phase 5 backend-owner coordination

## Phase 6 status and priority (2026-10-25)

No backend algorithm, schema or fixture was changed. The detailed numbered
entries below retain reproductions, affected code, expected/actual behavior,
proposed coordinated fixes and required regression tests. Phase 6 real API tests
verify the supported paths; they do not establish that these defects are fixed.

| Issue | Severity | Current impact / status | Owner handoff |
| --- | --- | --- | --- |
| 9 Finding identity | High | Distinct invariants may merge in suite counts, shrink targets and diff deltas | Stable invariant discriminator across detectors/signature/suite/shrink/diff; multi-invariant regression |
| 1 Input coercion | High | Other API clients can silently change payload meaning; frontend guarded | Strict typed payload/day validation; negative day/false string/unknown key regressions |
| 5 Rule identity | High | Duplicate IDs affect traces/maps/diff; frontend guarded | Shared rule-set validator; duplicate/override/cycle regression |
| 6 Condition parser | High | Extra/mixed conditions may be discarded; source-confirmed, frontend guarded | Strict raw union validation; mixed-group regression |
| 2 Nested scenarios | Medium | Invalid nested events become 500; frontend guarded | Typed ScenarioInput before handler; equivalent simulate/suite/diff 422 tests |
| 3 Silent fallback | Medium | novacart/empty custom run a different generator; UI prevents both | Explicit implemented enums and nonempty custom validation; branch tests |
| 4 Bounds | Medium | Raw zero/negative/unbounded caps; UI limits 1–200 | Shared request bounds; zero/negative/null/upper-bound regression |
| 10 Attribution | Medium | Same-ID changes can have empty attribution without a review flag | Explicit uncertainty/semantic attribution; effect/priority/state edit tests |
| 11 Scenario scope | Medium | Baseline-only boundaries, truncation, fixed patterns and source-only omission | Agree generation/diff semantics; candidate boundary/cap/source/denominator tests |
| 12 Reduction | Medium | Null reductions supported; non-monotone days prevent global-minimum claims | Keep nullable evidence; owner-reviewed non-monotone target/minimality tests |
| 7 Future compile | High before live use | Silent mock fallback, initialization before validation, swallowed 400; source-only | Explicit mode, input-first validation, safe errors and bounded calls; NEBIUS_HANDOFF.md |
| 8 Response schemas | Medium | Empty OpenAPI success models; client decoders mitigate only UI paths | Typed response models, nullable examples and OpenAPI regression |

Stress Testing, reports and comparison disclose identity/coverage/shrinking limits.
Breakdowns by severity/type count returned **unique signatures**, not unavailable
per-type occurrence frequencies. Original and reduced evidence remain inspectable.
Nebius handoff additionally identifies retry amplification and incomplete billing
telemetry; these are future live-integration blockers, not Phase 6 provider tests.

---

No backend code or shared benchmark results were modified. Reproduce bounded
offline probes with `npm run test:integration`, then
`node .test-output/tests/backend-contract-probes.js` from `frontend/` with FastAPI
running. The probe never calls compile or writes benchmark artifacts. It prints
observations, not acceptance claims for defective behavior. The canonical rule is
`starterRule()` from `lib/policy-domain.ts`; requests use it as `rules:[rule]`.

Categories: **A** frontend guard; **B** shared model/API contract change;
**C** deterministic algorithm change; **D** intentionally unsupported/deferred.

## 1. Negative days, payload fields and coercion — A protected, B unresolved

Locations: `models.py:319 Event`; `engine.py:336 _apply_payload_attributes`;
`api.py:270 simulate_journey`. Raw POST simulate with ITEM_DELIVERED day -1 returns
200 and delivery_day=-1. Unknown payload `unknown_field:true` also returns 200 and
is silently ignored. Payload `is_final_sale:"false"` returns 200 with
is_final_sale=true because Python bool(nonempty string) is true.

Expected: documented strict typed inputs, invalid/unknown values rejected with
422. Proposal: non-negative day constraint and a typed/closed payload validator
with intentional coercion policy; apply consistently before execution. This may
break callers relying on coercion or ignored fields, so coordinate schema/version
changes. Regressions: negative day, boolean strings, unknown keys, invalid tier,
numeric/string amounts, nullable day fields, ordering and valid fixture payloads.
Frontend validates closed field names, scalar types, non-negative safe days and
amounts before all supported analysis calls; it does not repair unsafe inputs.

## 2. Inconsistent nested scenario validation — A protected, B unresolved

Locations: `api.py:92 RunSuiteRequest`, `api.py:108 DiffRequest`,
`api.py:291 run_test_suite`, `api.py:408 diff_policies`;
`scenarios.py:210 validate_scenario` (not used by those handlers).
POST run-suite custom scenario `[{id:"bad",name:"Bad",journey:[{event_type:
"UNSUPPORTED",day:0}]}]` returns **500**, not a field-level 422. Event validation
occurs in the handler's broad exception catch. Validating the same Event in the
simulate request model produces 422.

Proposal: typed nested ScenarioInput model with shared validators and pre-handler
validation; explicitly document stable sorting versus input-order requirements.
Compatibility: invalid custom scenarios will change from 500/coerced results to
422; defaults/metadata omission may need a migration. Tests: invalid event enum,
missing day, malformed payload, empty journeys and stable equal-day chronology
across simulate, suite and diff. Frontend guards all custom entries before send.

## 3. Silent suite substitution — A/D prevented, B unresolved

Locations: `api.py:295–312 run_test_suite` and `412–429 diff_policies`.
`novacart` is accepted in RunSuiteRequest but has no implementation branch;
it falls through to boundary generation. `suite_type:"custom"` with an empty
scenario array also runs boundaries. Probe limit=1 produced one boundary journey
for all of boundary, novacart, and empty custom, HTTP 200.

Expected: requested supported suite is executed or invalid input is rejected.
Proposal: explicit novacart implementation or remove/deprecate its enum; reject
missing/empty custom scenarios with 422. Compatibility: clients that relied on
fallback must opt into boundary. Tests: each suite branch and missing/empty
custom inputs in suite/diff. Frontend never exposes novacart and blocks empty
custom suites; fixed-pattern "pairwise" is labelled honestly.

## 4. Scenario bounds — A protected, B unresolved

Locations: `api.py:92/108` limit definitions, `314/431` truncation conditions.
For pairwise input, limit 0 returned all 30 journeys; -1 returned 29. No upper bound
or custom-array/rule/event-count cap is enforced by the request models.

Proposal: coordinated positive-limit and request-size bounds, with explicitly
documented handling of null/unlimited requests. Impact: limit=0/-1/null callers
may need migration. Tests: zero, negative, over-limit, null and exact boundary
values; custom scenario array bounds. Frontend enforces 1–200 and finite selected
journeys, 100 rules / 50 events under the existing editor guardrails.

## 5. Rule identity and override integrity — A protected, B unresolved

Locations: `models.py:204 Rule`, API Rule lists; engine conflict resolution;
`diff.py:194 _diff_rules` maps by ID. Duplicate IDs and missing override targets
both returned 200 in direct simulate probes. Duplicates are ambiguous in traces
and are collapsed by rule-ID dictionaries during diffing.

Proposal: shared rule-set validator for unique IDs, existing/non-self compatible
override targets and cycle policy, applied to all endpoints. Compatibility:
previously accepted inconsistent sets will be rejected. Tests: duplicates,
missing/self/cyclic/cross-decision overrides, and valid v1/v2 fixtures. Frontend
already rejects these cases before activation and API transport.

## 6. Condition extra-property parsing — A protected, B source-confirmed

Location: `models.py:181 parse_condition_tree`. For nodes containing all/any,
the parser reconstructs a new group from only that key, so extra keys (including
mixed all+any) can be discarded before extra="forbid" validation.
Expected: reject unsupported/mixed condition structure. Proposal: validate the
whole raw node against strict union models; don't drop fields. Compatibility:
formerly tolerated condition JSON becomes invalid. Add tests for mixed groups,
unknown group keys, malformed leaves and valid nested trees. Frontend rejects
mixed/extra condition keys. No runtime compile probe was used.

## 7. Missing compile input / provider side effects — D disabled, B source-only

Location: `api.py:204 compile_policy`. LLMClient initializes before input checking;
mock/provider selection occurs before the try block; the intended missing-input
HTTPException(400) inside try is caught as generic Exception and rethrown as 500.
**Not runtime reproduced: compile execution was expressly prohibited.**
Proposal: validate mutually accepted document input before initializing a provider,
preserve HTTPException, and make mock/live behavior explicit. Compatibility:
status and fallback behavior changes require owner agreement. Required future
tests: missing/empty document input, provider initialization not called on invalid
input, explicit mock/live selection and preserved 4xx. Do not run these through
the compile route during this phase. Frontend compile is locally disabled.

## 8. Empty success schemas — B runtime-confirmed

Locations: all seven endpoint decorators/return dicts in `api.py`; GET
`/openapi.json` reports `{}` for each 200 application response schema.
Proposal: typed Pydantic response models, including nullable reduction/definition
fields and explicit status/error contracts. Compatibility: serialization/extra
field changes require fixtures and client decoder review. Tests: OpenAPI shape,
response-model validation and representative successful/nullable responses for
all endpoints. Frontend now validates used response fields and retains extras.

## 9. Finding signature collisions — C unresolved, high priority

Locations: `shrink.py:29 get_finding_signature`, `scenarios.py:354` grouping,
`diff.py:654 finding_sig`, invariant emitters in `detectors.py`.
Probe journey: ORDER_PLACED day0 amount_paid=100; REFUND_COMPLETED day1
refund_amount=200; REPLACEMENT_DELIVERED day2. It produces distinct violations
for refund_le_amount_paid, completion_requires_prior_request and
no_duplicate_restitution, all with `type=INVARIANT_VIOLATION, rule_ids=[]`.
They therefore share the same canonical signature. Some invariant details lack
a consistent invariant_id. Suite dedup can merge them, shrinking can preserve a
different invariant, and diff can miss a real introduced/resolved constraint.

Expected: preserve the intended invariant identity. Proposal: consistently emit
a stable invariant discriminator, then coordinate an identity/signature revision
across detectors, suite, shrink, diff, API and benchmarks. This is an algorithm
and response-compatibility change, not a frontend patch. Tests: multiple distinct
invariants with empty rule IDs, target-preserving shrink, and one-invariant-to-
another comparison. Generate benchmark artifacts externally; don't overwrite
shared results. UI explicitly warns about this limitation and original traces.

## 10. Inconclusive diff attribution — C unresolved

Location: `diff.py:280 _attribute_change`. Changing one starter rule's effect from
ALLOW to DENY while retaining its ID and condition changes the day1 refund outcome
but returns `attributed_rule_ids:[]`, needs_review=false. Both traces fire the same
ID, so symmetric set difference is empty.

Expected: inconclusive attribution acknowledged, not a causal claim. Proposal:
consider changed active/suppressed rule semantics and explicit attribution
confidence/status; preserve uncertainty for state-mediated changes. Compatibility:
new fields and stronger causal interpretation require owner-designed semantics.
Tests: same-ID effect, priority, override, state update edits and genuinely
inconclusive cases. UI labels IDs as candidates, shows Attribution unavailable
when empty, and never equates Not flagged with verified causality.

## 11. Coverage / definition-diff limits — C/D documented

Locations: `api.py:412 diff_policies` baseline-only boundary generation and
pre-execution truncation; `scenarios.py:128 generate_pairwise_scenarios` fixed
patterns; `diff.py:194 _diff_rules` omits source metadata comparison.
Source-only rule edit probe returns changed_rule_ids=[]; boundary scenarios can
miss candidate-only thresholds. Coverage counts fired rules (including suppressed
matches), observed event types and unique consecutive decision resolutions; it
does not establish global reachability or policy correctness. Health is a weighted
suite-dependent heuristic, not accuracy.

Coordinate whether to use the union of both policies' boundaries, actual pairwise
generation, source-aware metadata diffs, and transparent truncation provenance.
These would change results/coverage/benchmark expectations. Required tests:
candidate-only boundaries, cap ordering bias, source-only changes and metric
denominators. Current UI defaults to shared known journeys, offers an explicit
edited journey, and labels all limitations rather than changing algorithms.

## 12. Shrinking nullability / minimum claims — D handled, C potential limit

Locations: `scenarios.py:375` catches shrinking exceptions; `api.py` serializes
missing suite reductions as null. This is supported and handled, not repaired into
a fake journey. Standalone shrink was runtime verified for the canonical target.
The day reducer in `shrink.py:82` uses binary search; arbitrary structured condition
trees can be non-monotone in day, so global minimum/day-threshold claims are unsafe.
Any stronger minimality algorithm requires owner review and dedicated non-monotone
tests. UI says reduced counterexample and makes no globally-shortest/all-later-days
claim. No standalone UI screen was added because Issues already exposes reductions.

Please coordinate B/C changes with the backend owner before altering shared
contracts, identities, deterministic behavior or benchmark expectations.
