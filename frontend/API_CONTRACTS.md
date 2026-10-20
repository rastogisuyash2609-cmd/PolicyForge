# Phase 5 API contract and integration matrix

Audited against `backend/policyforge/api.py`, `models.py`, `scenarios.py`,
`shrink.py` and `diff.py`. No backend changes. Compile was inspected only: no
HTTP request to `/api/compile` was made. OpenAPI was retrieved through its GET
endpoint; all seven current 200 response schemas are `{}`. Frontend success
decoders therefore validate the concrete response shapes manually.

| Endpoint | Frontend integration | Runtime tested in Phase 5 | Result | Remaining issue |
| --- | --- | --- | --- | --- |
| GET `/api/health` | Typed client; not used as a blanket service status | Yes, real API | `ok`, service string | Success does not establish analysis health |
| GET `/api/default-data` | Shared provider, request deduplication/retry, typed decoder | Yes, API + browser | Documents, 12 v1 rules, 13 v2 rules, 5 journeys | Fixed fixture/document provenance |
| POST `/api/compile` | Local client intentionally rejects; prototype remains unmounted | **No; intentionally disabled** | Source/contract inspection only | Provider-sensitive behavior and missing-input error path need owner review |
| POST `/api/simulate` | Analyzer and Issues use active rules, scoped results, abort/stale guards | Yes, API + browser | Demo contradiction; custom allowed/default denied; actual per-event state | Backend accepts unsafe payload/day/coercion inputs from other clients |
| POST `/api/run-suite` | Issues uses explicit selected custom journeys; typed counters and nullable shrinking | Yes, API + browser | Custom, bounded boundary and fixed-pattern suites verified | `novacart` and empty custom silently fall back; no backend limit bounds; invariant identity collisions |
| POST `/api/shrink` | Available typed client; UI uses adequate suite-driven reductions, no redundant screen | Yes, real direct API + replay | Canonical target type/rule IDs preserved | Invariant identity ambiguity; no globally shortest/day-threshold claim |
| POST `/api/diff` | Working What-if; explicit fixtures/snapshot, selected suite, cap, cancellation/retry | Yes, API + browser | Five shared samples: 2 ALLOW→DENY events; 5 changed IDs | Limited/baseline-biased generated coverage, candidate-only attribution, signature and source-only diff limitations |

## Shared schemas

Rule: `id`, `name`, `decision` (REFUND/REPLACEMENT), `trigger` (EventType), `when`
(recursive all/any/field-op-value), `effect` (ALLOW/DENY), `source`
(`doc_name`, `verbatim_sentence`); `priority=0`, `overrides=[]`,
`state_updates=null`. Event: `event_type`, integer `day`, `payload={}`.
StateField and Operator enums are mirrored and tested for drift. No rule
condition uses eval/exec. Rule/Source/Event forbid extra top-level fields;
the backend's custom condition parser and payload validation have caveats in
`BACKEND_CONTRACT_FINDINGS.md`.

Finding: `type`, `severity`, `rule_ids`, `event_indices`, `trace`, and nullable
`details`. Decisions/failures always originate from Python, not frontend logic.
State values are exposed as typed unknown-valued records for inspection.

Frontend types are in `lib/api-types.ts`, decoders in `lib/api-contracts.ts`,
transport in `lib/http-client.ts`, and validated methods in `lib/api.ts`.
No `any` is used in these API modules. Additional backend fields are retained
for technical JSON inspection while required UI fields are runtime checked.

## Endpoint details

### Health / default data

Neither GET takes a body. Health returns `{status, service}`. Default data returns
`documents: Record<string,string>`, `rules_v1`, `rules_v2`, and
`sample_journeys[{id,name,description,journey}]`. No top-level nullable properties
are expected; nested rule state updates can be null. Provider status says Fixtures
loaded / Loading fixtures / Data unavailable, never “all endpoints operational.”

### Compile — inspection only

POST body: `documents?: Record<string,string> | null`, `document_text?: string |
null`, `doc_name?: string | null = "policy.md"`, `max_repairs=2`, `use_mock=false`.
Returns `total_clauses`, `mapped_clauses`, `unmapped_clauses`
(`id,text,doc_name,line_number`), `compiled_rules`, `rule_confidence`
(`rule_id,grounded,lint_clean,confidence,notes`), `rejected_rules`, `lint_warnings`,
`token_usage`, `latency_ms`, and `summary`. Request validation can return 422;
the generic handler converts errors, including its intended missing-input 400,
to 500. This observation is **source-only**, not runtime verified. The source
initializes LLMClient, uses mock when requested or when no key is found, and can
otherwise use a provider. The frontend compile method rejects locally, with no
transport call, so the offline workspace cannot accidentally invoke this path.

### Simulate

POST `{rules: Rule[], journey: Event[], default_decision_outcome?: Effect = DENY}`.
Success: `outcomes[{event_index,day,event_type,outcome,action_applied,
resolution_type,findings}]`, `final_state`, `findings`, and
`trace.event_traces`. Each trace includes evaluated/fired/active/suppressed rule
IDs, rule/leaf evaluations, outcome/resolution/explanation, findings, and separate
`state_before` / `state_after`. Backend sorting is stable by day; indices refer to
that execution order. Rule leaf evaluations retain actual/expected values in the
technical response. Schema errors return 422; execution errors become HTTP 500.

### Run-suite

POST `{rules, suite_type?: boundary|pairwise|novacart|custom = boundary,
custom_scenarios?: [{id?,name?,description?,journey?,tags?}] | null,
default_decision_outcome?: DENY|ALLOW = DENY, limit?: int|null = 30}`.
Custom scenario entries are dictionaries on the backend, not a strongly validated
nested request model. Their Event validation happens inside the handler.

Success fields: `total_scenarios` (journeys executed), `passed_scenarios`
(journeys with no findings), `failed_scenarios` (journeys with findings),
`total_findings` (occurrences), `findings_count` (unique signatures),
`findings[{signature:[type,sortedRuleIDs], finding, shrink}]`, `summary_table`
(Markdown). Shrink is nullable; it contains original/minimal journeys and lengths,
engine runs and reduction percentage. Failed reduction does not remove the
original finding. The UI handles missing optional shrink as unavailable too.
422 covers outer request/schema validation; invalid nested custom Events can
produce 500; other execution errors produce 500. The frontend accepts only real
boundary/pairwise/custom methods, rejects empty custom input, validates each event,
requires scenario IDs/names and enforces a positive cap of at most 200.

`pairwise` is currently 30 fixed pattern/flag journeys, not proven all-pairs
coverage. `novacart` has no separate branch and runs boundary generation.
Empty custom also falls through to boundary. Zero disables truncation; -1 slices
off the final case. None of those fallback/invalid inputs is offered by the UI.

### Shrink

POST `{rules, journey, target_finding_type?: FindingType|null,
target_rule_ids?: string[]|null, default_decision_outcome?: Effect=DENY}`.
Success: `original_journey`, `minimal_journey`, `original_length`,
`minimal_length`, `engine_runs`, `reduction_pct`, `finding`. No nullable top-level
success values. With no findings, HTTP 400 is preserved. Missing target/algorithm
errors become 500; schema errors return 422. Target identity is type plus sorted
rule IDs, which is insufficient to distinguish all invariants. The suite already
provides usable reduced reproductions; no standalone shrink page was needed.

### Diff

POST `{rules_v1, rules_v2, suite_type?: boundary|pairwise|custom=boundary,
custom_scenarios?: ScenarioDictionary[]|null, default_decision_outcome?: Effect=DENY,
limit?: int|null=30}`. Same custom/limit pitfalls as run-suite. No `novacart` enum.

Success: `total_scenarios`, `changed_rule_ids`, `outcomes_allow_to_deny`,
`outcomes_deny_to_allow`, `outcome_changes[{scenario_id,scenario_name,event_index,
day,event_type,outcome_v1,outcome_v2,resolution_v1,resolution_v2,
attributed_rule_ids,explanation,needs_review}]`,
`finding_deltas[{scenario_id,direction:INTRODUCED|RESOLVED,finding}]`,
`scenarios_needing_review`, `rule_text_diffs[{rule_id,status:ADDED|REMOVED|MODIFIED|
UNCHANGED,v1_summary,v2_summary,changes}]`, `coverage_v1/v2`, `health_v1/v2`,
`summary` (Markdown). Definition summaries can be null for added/removed rules.
Coverage includes `rule_coverage`, `rules_fired`, `rules_total`,
`uncovered_rule_ids`, `event_type_coverage`, `transitions_observed`. Health includes
`score`, `no_critical_findings`, `rule_coverage`, `no_gaps`, `no_ambiguities`,
`event_coverage`. 422 covers outer models; nested custom validation/execution can
return 500. Frontend custom scenarios are strongly guarded before transport.

The outcome counts are events, not scenarios. Changes include resolution-only
changes. Candidate rule attribution compares fired IDs and can be empty even for
a real effect/priority edit. Finding deltas share the collision-prone signature.
Boundary input comes only from baseline rules and is truncated before execution.
Default What-if uses shared known journeys, explicitly states cap and actual
execution count, and never claims exhaustive regression or causal proof.
