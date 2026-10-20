# Phase 4 completion report — offline policy analysis

## A. Implementation summary

Implemented `/workspace/analyze`, Demo Policy selection, manual structured-rule
creation/editing/import, rule validation and inspection, explicit activation,
shared active rules, scenario selection/editing, deterministic simulation results,
and active-policy Issues/Policies integration. The Phase 2/3 design system,
navigation, local fonts, themes and original NovaCart workflow are preserved.

No backend files, fixtures, API contracts, dependencies, credentials or Nebius
configuration were changed. No compiler endpoint, real LLM provider, external AI
inference, or paid AI call was used. The new route does not import the unmounted
Compiler component. Phase 5 has not begun.

## B. Updated application workflow

Demo: select NovaCart v1 or v2 → inspect original known rule fixture and reference
documents → review validation → Activate rules → choose/edit a journey → Run
Simulation → inspect actual findings, decisions, rule evaluations and event state.

Custom: choose Custom structured rules → name the policy → optionally paste
reference text → Add rule and edit the form/condition tree, or import a Rule array
through advanced JSON → fix validation → activate → run a supported journey.
Policy text alone never supplies rules. Clear draft clears only editor input,
not the active policy. Editing prose does not modify rules; warnings explain this.

Existing routes remain functional: `/` landing, `/workspace` redirect to Issues,
`/workspace/issues`, `/workspace/policies`, and the unfinished direct
`/workspace/what-if` route. Analyze Policy is available in desktop and mobile nav.

## C. Pages and components

All paths below are relative to `frontend/`.

| File | Purpose |
| --- | --- |
| `app/workspace/analyze/page.tsx` (new) | Analyze route and descriptive metadata |
| `components/screens/AnalyzeScreen.tsx` (new) | Two-panel policy preparation/review, offline guidance, activation and scenario area |
| `components/policy/structured-rule-editor.tsx` (new) | Editable IDs, names, decision/effect, priority, matching trigger, overrides, source metadata, JSON import |
| `components/policy/condition-editor.tsx` (new) | Recursive all/any/leaf controls and closed field/operator choices |
| `components/policy/rule-inspector.tsx` (new) | Reusable readable conditions, effects, priority, source, overrides/state updates and complete JSON |
| `components/policy/scenario-workbench.tsx` (new) | Known scenario loader, event/day editing, event/payload JSON, suite selection, execution/errors/retry |
| `components/policy/simulation-results.tsx` (new) | Actual outcomes, findings, timeline, fired/active/suppressed rules, evaluation/source details, state changes and JSON |
| `lib/policy-domain.ts` (new) | Frontend enum mirror, guarded rule/journey validation, drafts, explicit activation and display fingerprint |
| `lib/latest-request.ts` (new) | Request replacement/cancellation and stale identity guard |
| `lib/use-policy-simulation.ts` (new) | Active-rule simulation lifecycle keyed to current scenario input |
| `lib/use-issues-analysis.ts` | Use active rules/selected suite journeys; protect suites against stale completion and invalidate changed selections |
| `lib/api.ts` | Typed finding/event evaluation fields, active/suppressed rules, optional abort signals and readable FastAPI validation errors |
| `components/workspace/workspace-provider.tsx` | Persistent drafts/active policy/scenario state and revision-keyed analysis session |
| `components/workspace/workspace-shell.tsx` | Analyze nav link and truthful active-origin/revision context |
| `components/workspace/workspace-view.tsx` | Analyze route view and shared loading/error boundary |
| `components/screens/PoliciesScreen.tsx` | Inspect the active rules and supplied reference text, not hardcoded v1 data |
| `components/screens/IssuesScreen.tsx` | Active identity/counts/copy; retain original finding/reproduction UI |
| `app/globals.css` | Shared accessible form-field styling using existing tokens |
| `tests/policy-workspace.test.ts` (new) | Validation, activation, enum drift, request gates and editor/result markup tests |
| `tests/offline-api.test.ts` (new) | Real local fixture/custom simulation/suite and 422 integration checks |
| `package.json` | Run added unit tests; add separate real API integration script |
| `README.md` | Workflow, lifecycle, editor constraints, checks and limitations |
| `PHASE4.md` (new) | This report |

## D. Active policy architecture

WorkspaceProvider retains default-data request state, editor mode/example/name/
text/rule JSON, inspected rule index, active policy, scenario name/JSON and suite
selection across normal route navigation. A draft never mutates active rules.

Activation independently validates the draft and creates an immutable parsed rule
snapshot with name, demo/manual origin, source/reference text, normalized rules,
warnings, display fingerprint and monotonically increasing revision. The existing
valid NovaCart v1 fixture remains the initial active policy for backward
compatibility; Analyze starts with an empty, non-activatable draft.

Each active revision keys a new AnalysisSession. Old suite requests are aborted;
pending Issues simulations have stale-version/unmount protection; Analyzer
simulations have abort and request identity guards. Activating cannot relabel old
NovaCart results as custom output. Fingerprints are non-cryptographic display
identifiers; revision/session identity, not the hash, controls invalidation.

Scenario input identity hides previous Analyzer results immediately when edited
and cancels stale execution. Selected suite journeys have a separate result scope:
changing them clears only suite results and cancels an older suite request, while
preserving the editor, checkbox focus, open selector, and independent simulation.
The first selected suite runs on entering Issues; normal navigation does not
unnecessarily reload fixtures or rerun an unchanged suite.

Hard reload or leaving the workspace discards all transient custom policy/editor/
analysis state and restores default NovaCart v1. No database or permanent history
was added. Theme preference persists. Native disclosures and Analyzer trace-step
selection reset on page unmount; Issues timeline selection stays in its hook.

## E. Backend connections

All seven application endpoint contracts were reviewed; none changed.

| Endpoint | Phase 4 status |
| --- | --- |
| GET `/api/health` | Local service verified healthy |
| GET `/api/default-data` | Used for known documents, both rule versions, and sample journeys; browser/API verified |
| POST `/api/simulate` | Used with exact active rules and validated event sequence; real demo/custom/browser/API verified |
| POST `/api/run-suite` | Uses selected custom-scenario array and explicit limit; real five-journey and one-journey checks verified |
| POST `/api/compile` | Deliberately not invoked or exposed; automatic prose extraction unavailable |
| POST `/api/shrink` | Not called directly by the UI; existing run-suite returns backend-reduced reproductions used by Issues |
| POST `/api/diff` | Reviewed but not integrated or exercised in Phase 4; What-if remains unfinished |

Event input is retained in user order. The backend sorts by day stably; returned
trace order is used for result event indices and state inspection. Equal-day
events retain input order. Scenarios test only the supported engine domain;
unruled decisions are meaningful coverage gaps, not silently filtered out.
No backend enhancement was necessary. Future contract-hardening work is listed
under K rather than implemented against teammate-owned code.

## F. Demo vs custom rules

Demo rules are copied exactly from known `/api/default-data` v1/v2 fixtures and
labelled Demo Policy. No generation or compilation claim is made. V2 includes
revised rule quotations while the provided document pack remains original; both
the draft and activated policy warn about that distinction.

Manual form edits/imports mark origin Manual rules, even when starting from a demo.
Source metadata is explicitly user-supplied/not independently verified; no source
quote or confidence score is invented. Blank quotation is allowed with a warning.
Reference text edits generate a persistent activation warning and never alter
conditions or quotations. Natural-language extraction and demonstration compiler
output are not exposed, so no mock rules can silently replace arbitrary prose.

## G. UI/UX improvements

Reused semantic light/dark tokens, shared cards/buttons/status/error/disclosure
components and Geist. On wide screens, policy preparation and rule review sit
side by side; smaller screens stack them. The shared inspector avoids a raw JSON
wall, while advanced fields remain available for imports, membership arrays,
state updates and payloads. Scenario rows have labelled event/day controls,
add/remove/reset actions and explicit execution.

Results show active policy/scenario, actual decisions and findings, event timeline,
rule evaluation reasons, original source text, suppressed rules, human-readable
state deltas and separately labelled before/after/final state. Zero findings is
qualified to the tested journeys, never a guarantee of correctness. Empty drafts,
invalid JSON/rules/scenarios, warnings, loading, success, missing connection and
retry states are present. No synthesized findings or fabricated partial output.

Native controls, visible focus, named form fields, live status/errors, 44px main
controls, inherited reduced motion, semantic headings and accessible shared mobile
navigation target AA. This is not an accessibility certification.

## H. Testing results

| Check | Actual outcome |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed without warnings/errors |
| `npm test` | 24 passed, 0 failed |
| `npm run test:integration` | 3 passed against real local FastAPI; no mocked connectivity claim |
| `npm run build` | Passed with Analyze route and existing routes prerendered |
| Backend `pytest -q -m 'not live'` | 117 passed, 1 optional live test deselected |
| Browser demo flow | Known rules → activate → canonical journey → real contradiction/denial and trace |
| Browser custom flow | Form-created/imported 30-day rule → activate → day 15 ALLOW → day 31 default DENY/gap |
| Active propagation | Policies displays only the custom rule; Issues runs the same rules with no old demo contradiction |
| Lifecycle | Navigation retains draft/results; activation clears old results; invalid input blocks execution; scenario edits invalidate results |
| Suite selection | Checkboxes stay open/focused; one selected allowed journey yields one tested journey and zero findings |
| Regression | Original two-finding NovaCart suite, live day-30 edit, selected intermediate state, Back/Forward and mobile Analyze navigation verified |
| Responsive | 40 checks: demo Analyzer, manual Analyzer with results, Policies, Issues × five requested widths × both themes; no root overflow |
| Connection failure | Controlled backend stop: simulation and suite errors visible; Retry simulation / Re-run tests recover after restart |
| Final normal navigation console | No warnings/errors in the post-recovery check |
| `git diff --check` | Passed |

Tests include malformed/missing properties, closed enums, condition structure and
scalar types, duplicate IDs, missing/self/cyclic/incompatible overrides, state
updates, typed payloads, stable input chronology, activation snapshots/revisions,
stale-request gates, source qualifiers, editor/result rendering and enum drift
against Python source. Real API tests also verify backend 422 rejection.

The suite-selector remount issue was found during lifecycle review, fixed, rebuilt,
and explicitly browser-tested. Expected connection errors during deliberate
backend outage and stale frontend fetches during server replacement are separate
from the clean final normal-navigation console. No unresolved failing checks.

Production first-load JS is 127 kB for workspace routes and 108 kB for the landing
page (Next build output, not a Lighthouse score). No new runtime/testing package.

Screenshots and `phase4-responsive-checks.json` are saved with the `phase4-` prefix
under `C:/Users/Suyash Rastogi/.codex/visualizations/2026/10/20/01a15aac-8e4b-7dd1-900e-f63850197fcc/`.
They include demo/manual desktop/mobile light/dark and real result views.

Skipped/untested: optional live LLM test; all live Nebius/provider calls; What-if
integration; cross-browser engines; screen-reader hardware; formal accessibility
audit/certification; dedicated OS-level reduced-motion run; reusable browser E2E
runner and Lighthouse. Actual browser checks used the available in-app browser;
the checked-in automated suites use Node/TypeScript and real local API requests.

## I. Known limitations

- No natural-language extraction, Nebius integration or credentials needed.
- Supported domain remains refund/replacement order journeys; no other policy categories.
- UI guardrails intentionally support a stricter typed subset of permissive backend
  coercions: non-negative days/amounts, safe integer priorities, matching request
  triggers, typed operands and acyclic compatible overrides.
- Editor limits: 100 rules, 50 events, eight nested condition levels, 200,000 rule
  JSON characters, 100,000 scenario JSON characters, 50,000 reference-text characters.
- Membership arrays/state updates/payloads use advanced JSON; no file-upload workflow.
- Issues suites select existing demo journeys; manually built journeys run through
  the Analyzer. Coverage is scenario-specific, not exhaustive.
- No permanent persistence, history, authentication, database, or comparison UI.
- Success-response runtime validation remains incomplete; backend invariant grouping,
  attribution/coverage and formal response models remain prior audit follow-ups.
- Client aborts ignore stale responses but cannot guarantee server-side work stops.

## J. Git summary

Started clean at `9f832f0` and remained on `codex/frontend-design-system`.
Phase 4 is one local stage commit: `feat(frontend): add offline active policy analysis`.
The final commit hash and working-tree status are reported in the completion
message. No push, force-push, merge, main modification, backend change, fixture
change, credential edit, or dependency installation was performed.

## K. Phase 5 handoff

Do not treat the unmounted Compiler or PolicyDiff components as completed product
workflows. Continue future integration only when requested. Harden typed success
responses and error contracts in coordination with the backend owner; add runtime
response validation and stronger reusable hook/E2E coverage. Consider per-route
bundle splitting, explicit timeout/server cancellation behavior and richer payload/
membership/state-update form controls if useful.

What-if should eventually consume the active rule set and an explicitly selected
comparison snapshot through `/api/diff`, retaining provenance and separating rule
text differences from actual behavioral outcomes/coverage. It remains a placeholder.

Future live AI extraction should be an explicit, separately configured compile
adapter with submitted document identity, grounded/rejected/unmapped rule review,
clear mock-vs-live mode, no automatic provider calls, and deliberate activation of
accepted rules. Reuse `api.compile`/`CompileResponse` and the existing backend
CompileRequest contract only after the next authorized integration phase. Findings
must continue to originate exclusively from deterministic Python execution.
