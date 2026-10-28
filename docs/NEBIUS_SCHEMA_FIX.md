# Phase 7E: schema mismatch fix, offline only

Date: 2026-10-29. Zero additional Nebius API requests or paid inference. Two live
requests were already completed before this phase; their combined estimated cost
was reported as $0.00047450. This phase does not query account balance or model access.

## Actual model contract

Source of truth: `backend/policyforge/models.py`, inspected in full, including
`Rule.model_json_schema()` and the nested Pydantic definitions. No models,
validators, enum aliases or deterministic algorithms were changed.

| Structure | Required fields / shapes | Optional fields / defaults |
| --- | --- | --- |
| Rule | `id`, `name` strings; `decision`; `trigger`; `when`; `effect`; `source` | `priority: int = 0`, `overrides: list[str] = []`, `state_updates: dict[StateField, Any] \| None = null` |
| LeafCondition | `field: StateField`, `op: Operator` | `value: Any = null`; the prompt always requires an explicit `value`, including null where appropriate |
| AllCondition | `{"all": [ConditionTree, ...]}` (AND) | No other model fields |
| AnyCondition | `{"any": [ConditionTree, ...]}` (OR) | No other model fields |
| ConditionTree | LeafCondition, AllCondition or AnyCondition; groups nest recursively | No inferred conversion from dynamic state keys |
| RuleSource | `doc_name`, `verbatim_sentence`, both strings | No optional fields |
| Event | `event_type: EventType`, `day: int` | `payload: dict[str, Any] = {}` |
| Actions | No separate `Action` model or rule `actions` array exists; outcomes use `effect: ALLOW \| DENY` | Explicit state changes use `state_updates` with StateField keys |

`decision` supports `REFUND`, `REPLACEMENT`. Canonical operators are `EQ`, `NEQ`,
`LT`, `LTE`, `GT`, `GTE`, `IN`, `NIN`, `IS_TRUE`, `IS_FALSE`, `IS_NULL`,
`IS_NOT_NULL`. Existing mathematical aliases (`==`, `!=`, `<`, `<=`, `>`, `>=`)
remain supported by the existing enum; the prompt requests canonical operators.
Unknown operators are rejected.

The event vocabulary is `ORDER_PLACED`, `ITEM_DELIVERED`, `REPLACEMENT_REQUESTED`,
`REFUND_REQUESTED`, `RETURN_RECEIVED`, `REPLACEMENT_CANCELLED`, `ORDER_CANCELLED`,
`ITEM_DAMAGED_REPORTED`, `REFUND_COMPLETED`, `REPLACEMENT_DELIVERED`,
`CHARGEBACK_FILED`, `CHARGEBACK_RESOLVED`.

Condition fields and state-update keys use the closed StateField enum: `order_placed`,
`order_day`, `item_delivered`, `delivery_day`, `days_since_delivery`,
`replacement_requested`, `replacement_request_day`, `replacement_cancelled`,
`replacement_cancel_day`, `replacement_active`, `replacement_completed`,
`replacement_completed_day`, `refund_requested`, `refund_request_day`,
`refund_completed`, `refund_completed_day`, `return_received`, `item_damaged`,
`is_final_sale`, `item_opened`, `customer_tier`, `refund_eligibility_restored`,
`action_denied`, `amount_paid`, `refund_amount`, `chargeback_active`.

The corrected `{"field":"days_since_delivery","op":"LTE","value":30}`
passes validation both as a LeafCondition and as `when` inside a complete Rule.
It is not a complete Rule or a complete `{"rules":[...]}` response. All seven
mandatory Rule fields must still be present. A journey Event object is separate
from a rule's trigger enum; extraction does not generate a journey.

Existing models use `extra="forbid"`. They are not universally strict-type models:
leaf values and event/state-update payload values remain `Any`, and the existing
Rule pre-validator parses group dictionaries. This change does not redefine those
existing behaviors or claim schema validity establishes business correctness.
The existing compiler checks nonempty verbatim source grounding locally under
case/whitespace normalization and performs local lint after Rule validation.

## Failure diagnosis and prompt changes

The second provider request completed with `finish_reason=stop`; truncation was
not the problem. The response's condition used a state field as a dynamic object
key. `Rule.parse_when_tree` does not recognize that shape and raises a validation
error before compiler grounding. The previous smoke prompt showed a leaf template
but lacked an explicit prohibition of dynamic keys and a complete valid example.
`json_object` constrains JSON syntax, not conformity to this Policy IR. We cannot
establish the model's internal reason for choosing the incorrect shape.

The shared compiler prompt now:

- Derives required Rule/source fields, leaf keys, supported events, operators,
  decisions, effects and fields from the actual Pydantic JSON Schema. Optional
  defaults come from Rule.model_fields.
- Requires explicit `field`, `op`, `value` on each leaf and explicitly labels
  `{"days_since_delivery":{"op":"LTE","value":7}}` invalid.
- Describes recursive `all`/`any` groups and requests one node shape without extra keys.
- Includes one small complete Rule envelope constructed through the real Pydantic
  models. Its separate seven-day policy is labeled format-only; instructions require
  current-input source text and prohibit copying example values.
- Preserves exact source-copy instructions and forbids invented conditions,
  exceptions and additional denial rules. No JSON correction or value normalization
  was introduced.

The smoke runner now reuses this builder with only the refund-relevant event,
decision and state-field vocabulary. It does not replace the prompt with a second
hand-maintained contract. No full recursive JSON Schema is dumped into the prompt;
the concise instructions and example communicate the needed structure.

The exact example embedded in both prompts is locally validated:

```json
{"rules":[{"id":"example","name":"7-day refunds","decision":"REFUND","trigger":"REFUND_REQUESTED","when":{"field":"days_since_delivery","op":"LTE","value":7},"effect":"ALLOW","source":{"doc_name":"example.md","verbatim_sentence":"Customers may request a refund within 7 days of delivery."}}]}
```

Omitted optional fields take their existing Pydantic defaults. This example is a
format demonstration, not a fabricated result for the live 30-day policy.

## Structured-output compatibility

[Nebius's official structured-output documentation](https://docs.tokenfactory.nebius.com/ai-models-inference/json)
documents `response_format.type=json_schema` and `json_object`, with model-dependent
capability guidance. Its examples use other models; arbitrary JSON does not ensure
predetermined fields.
[The official Nano cookbook](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/nemotron3-nano-30b.md)
advertises structured output for Nano, but provides no exact `json_schema` example
or compatibility specification for the configured model and recursive Policy IR.

Installed SDK types support `response_format={"type":"json_schema", "json_schema":
{"name":..., "schema":..., "strict":...}}`. An offline MockTransport test confirms
serialization of the schema derived from SmokeEnvelope.model_json_schema(). This
does not test Nebius's gateway or prove constrained decoding. The real schema has
recursive references/anyOf, unconstrained `Any` values and state-update propertyNames;
their support as a strict provider schema is not established by the SDK accepting it.

Compatibility for this exact model/API/schema combination remains **unverified**,
not proven unsupported. Following the requested fallback, production parameters
remain `response_format={"type":"json_object"}`. No speculative schema mode,
alternative endpoint, parameter probe or automatic fallback request was added.
Model reasoning settings are unchanged at provider default.

## Safeguards and validation

The dedicated smoke path retains: one atomic provider attempt per explicit CLI
execution; 1536 output tokens; 30-second SDK/HTTPX timeout per network operation;
zero SDK/wrapper/transport retries, compiler repairs and fallback requests;
redirects disabled; no background/scenario calls. Default CLI remains local
preflight only. Invalid/truncated output stops without another inference. Existing
Pydantic and grounding checks remain mandatory. General compiler/API configuration
outside the dedicated smoke runner was not altered.

The new sanitized second-live fixture contains only observed metadata and the
offending condition; its surrounding test rule is synthetic. Raw provider content,
reasoning and credentials were not persisted. Tests use mock transports, while
tests/conftest.py blocks real HTTPX transports for non-live tests.

Results: **189 passed, 1 live test deselected** in the full offline backend suite.
Local CLI preflight confirmed the configured Nano model, `prepared_live_disabled`,
1536 output tokens, 30 seconds, zero retries/repairs, and **0 provider requests**.
Coverage includes correct leaf within a complete parent, every required parent
field, malformed dynamic keys at root/AND/OR positions, unsupported operators,
nested round trips, exact embedded example validation, grounding, truncated output,
single-call failure behavior, SDK mock serialization, defaults, redaction and API
regression tests. No frontend files changed, so frontend/TypeScript/build checks
were not rerun for this backend-only phase.

Files changed: compiler.py, nebius_smoke.py, test_compiler.py, test_models.py,
test_nebius_smoke.py, second_live_metadata.json, NEBIUS_SMOKE_TEST.md, this report.

## Next decision

One further controlled live test is justified after fresh approval: the prompt now
directly addresses the observed schema mismatch and the offline regression suite
passes. This is not a guarantee of model compliance. The output cap stays 1536;
any further invalid/truncated result must stop without retries or semantic repair.

The following command is prepared, **not executed**:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.nebius_smoke --execute-one-request
```

No third live request, full benchmark, frontend AI action or subsequent phase was
started. Stop and wait for explicit authorization.
