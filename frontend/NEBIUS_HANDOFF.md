# Phase 6.5 integration handoff — plan only

**Historical plan:** Phase 8 has implemented the guarded UI/API integration offline.
See `../docs/PHASE8.md` for current behavior and deployment blockers. Live AI
remains OFF; no additional provider call occurred during Phase 8.

Phase 6 incurred zero provider inference cost. No credentials were inspected,
requested or configured. No `/api/compile` HTTP request or live benchmark ran.
This document describes future coordinated work, not enabled functionality.

## Existing implementation (source inspection)

- `backend/policyforge/llm.py:LLMClient` uses the OpenAI-compatible SDK. It resolves
  Nebius environment variables, then OpenAI fallbacks, then a built-in endpoint
  and model string. Those defaults have **not** been validated against current
  provider availability or prices. Confirm the desired Nemotron model before use.
- `chat_complete` records model, latency, prompt/completion/total tokens and success
  in process-local call history. Mock usage is an approximate word count; never
  label it billable usage. Missing provider usage currently becomes zero, which
  should become **unknown**, not an assurance of no spend.
- The wrapper defaults to three retries after the first attempt. The SDK also
  has its own retry behavior unless explicitly configured. Compiler repairs
  default to two per clause. Their multiplication can consume credits rapidly.
  Compilation loops over clauses/documents, so one HTTP request can make many
  provider requests. Failed/intermediate attempt costs are not reliably captured
  by the current aggregate; timeout does not establish that a call was unbilled.
- `api.py:compile_policy` accepts `documents` or `document_text`, `doc_name`,
  `max_repairs=2`, `use_mock=false`. It constructs LLMClient before validating
  document input. Missing credentials silently activate a fixture substring
  responder. Its broad exception handler changes intended missing-input 400 to
  500. Compile behavior was inspected, never executed during Phase 6.
- Response fields: clause totals/mapped/unmapped, compiled_rules, rule_confidence,
  rejected_rules, lint_warnings, token_usage, latency_ms, summary. All current
  OpenAPI 200 schemas are empty; a live compile decoder remains to be designed.
- `compiler.py` validates closed schemas, source grounding and lint before
  returning rules. Its extraction quality labels are not deterministic policy
  correctness, calibrated probabilities or evidence that no failures exist.

## Backend-owner agreement required before activation

1. Validate nonempty bounded document inputs before provider initialization;
   preserve intentional 4xx. Decide explicit mock/live mode semantics. A live
   request with missing credentials must fail closed, with no silent mock result.
2. Agree typed compile success/error contracts and explicit provenance:
   mode, provider/model, request ID, source documents, rules, rejected clauses,
   grounding/lint status, call/repair counts, usage completeness and latency.
   Keep existing callers compatible or document a versioned change.
3. Bound document bytes/clauses, output tokens, repairs, total provider calls,
   elapsed time and estimated spend per user action. Disable both SDK and wrapper
   retries for the initial live trial. Use zero repairs. Persist an explicit
   budget guard independently of UI cancellation; browser abort cannot promise
   synchronous backend/provider cancellation.
4. Normalize authentication/authorization, rate limits, quota exhaustion,
   provider 5xx, timeout, malformed JSON, schema rejection and grounding failures.
   Errors must preserve safe diagnostics without keys, document echoes or raw
   provider exception dumps. Unknown usage on an error remains unknown.
5. Keep deterministic finding identity/engine work separate. The high-priority
   invariant signature defect in BACKEND_CONTRACT_FINDINGS.md is not solved by
   connecting an LLM. Coordinate source/schema/identity changes with the owner.

## Frontend path into active analysis

- Keep repository demo, manually authored rules and live extraction visibly
  distinct. The current `.compile()` method intentionally rejects locally; do
  not merely remove that guard before the backend contract and controls exist.
- Add a separate explicit **Extract rules** action. No extraction on mount,
  typing, theme changes, navigation or routine tests. Explain model, bounded
  input, usage/spend estimate and possible multi-call behavior before execution.
- Add typed compile response validation and existing transport cancellation,
  timeouts, retries controlled by the user, and stale-input protection. A provider
  failure must not replace active rules or masquerade as successful mock output.
- Present extracted rules as a **draft** with clause coverage, rejected clauses,
  source quotations and lint/grounding notes. Reuse structured validation/editor.
  Activation remains an explicit action after review; prose changes do not
  silently activate or update rules.
- Extend the current demo/manual origin model deliberately for live provenance;
  preserve immutable rules/revision and compile metadata in reports. Activating
  accepted extracted rules must reset simulation, suites, diff and report scope
  through the existing revision-keyed AnalysisSession.
- Simulation, shrinking, detectors and comparison remain deterministic Python.
  LLM narrative must explain recorded findings, never decide whether one exists.

## Security and approximately $29.50 budget

Use backend-only `.env` credentials excluded from Git. Never put secrets in
NEXT_PUBLIC variables, browser storage, URLs, fixtures, screenshots or reports.
Avoid OpenAI credential/provider fallback for explicitly selected Nebius mode.
Keep the local server bound to loopback for development. Do not request a key in
Phase 6. The user configures credentials only when Phase 6.5 is authorized.

Before the first request, verify current official model input/output pricing and
model context limits. Record the price date, model and currency. Estimate:

`input_tokens / 1_000_000 * input_rate + output_tokens / 1_000_000 * output_rate`

Account for cached-token rates only when actually supplied and supported. Retain
per-attempt usage and aggregate the complete action, including repairs. A failed
request with missing telemetry must not be counted as zero cost. Reconcile with
the provider's balance/dashboard; local estimates are not authoritative billing.

Proposed initial ceiling: **$0.25 total**, subject to the user's explicit approval
and verified rates. Reserve the remaining approximately $29.25 for later demos;
do not automatically spend the remainder. Set a lower request cap if supported.

## Initial testing sequence (future, not executed)

1. Recorded and injected responses: valid, invalid vocabulary, malformed JSON,
   grounding failure, missing credentials, quota/rate-limit/timeouts, repairs,
   missing usage, draft activation, stale replies, provenance and report exports.
   Block external sockets in these tests; do not use real keys.
2. Confirm server-side spend/call/output limits and both retry layers are disabled.
   Use one short synthetic policy clause. One clause avoids the current compiler's
   per-clause fanout. Confirm the exact intended provider/model and mode.
3. Obtain explicit user approval for **one** live provider call, with the chosen
   model, rates and ceiling. Do not initiate it as part of Phase 6 or CI.
4. Record request ID, success/failure, prompt/output/total tokens, completeness,
   latency, estimated charge and balance delta. Stop after this call. Preserve
   a sanitized recorded response for repeatable future offline tests.
5. Review extraction, schema, source grounding and draft activation. Any retry,
   repair or second live sample needs a separate explicit decision within budget.

## Phase 7 offline readiness

The frontend contract/validation/request-gate tests, deterministic Python tests,
real local simulation/suite/shrink/diff integration tests, report serialization,
and browser workflow/responsive checklist are ready to rerun after integration.
Add recorded compile cases and origin propagation to them. Live tests remain
opt-in, excluded from standard regression commands and CI. No automated paid
regression suite or live benchmark should be introduced by default.
# Phase 8 status

The guarded UI/API integration is now implemented and tested offline. The historical
handoff below records earlier constraints. See `../docs/PHASE8.md`,
`../docs/DEPLOYMENT.md`, and `../docs/STAGE2_POLICY_CASES.md` for current behavior.
No Phase 8 live inference occurred; feature opt-in remains OFF locally.
