# Phase 6 completion report

## A. Executive summary

Implemented active-policy Stress Testing, reproducible analysis reports with
Markdown/JSON downloads, clearer comparison completion/provenance, and richer
event-specific explanations. Retained Quiet Intelligence tokens, Geist, shared
controls, light/dark themes and deterministic Python ownership of decisions.

No backend implementation, dependency, fixture or tracked benchmark output was
changed. No authentication, database, persistent history, unsupported domain or
PDF generator was added. No Nebius credentials were requested/configured/read;
no paid provider call, live benchmark or `/api/compile` HTTP request was made.
Phase 6.5 and Phase 7 are not implemented.

## B. Stress Testing

`/workspace/stress-test` is available in desktop and mobile navigation. It
replaces the unmounted prototype's automatic demo-v1 request with an explicit
run against the exact active policy/revision. Select/activate rules through the
existing Analyzer; suite controls never silently substitute a different policy.

Supported suites: boundaries generated from active rules, honestly named fixed
patterns (backend `pairwise`), or the selected known Analyzer demo journeys sent
as `custom`. `novacart` and empty custom fallbacks are not exposed. Caps are
integers 1–200. Default DENY, first-case truncation, limited coverage, timeout,
cancel, retry and input invalidation are explicit. Normal navigation preserves
the session; activation replaces it and cancels stale work.

Cards distinguish journeys executed, journeys with findings, finding occurrences
and unique signatures. Type/severity breakdowns count returned unique signatures;
the API does not supply occurrence frequencies per type. Findings expose severity,
rule IDs, original zero-based event indices, actual traces and source evidence.

Counterexamples show original/reduced journeys, payloads, retained/removed event
alignment, changed-day caveats, original/reduced lengths, percentage reduction and
reducer engine runs. Identical repeated events can make alignment ambiguous.
No global-minimum or exhaustive-coverage claim is made. Null reductions remain
missing. A user-triggered replay calls `/api/simulate` with the actual reduced
journey and active rules, showing recorded decisions/evaluations/states and a
type/rule-ID signature check with the invariant-collision limitation.

Actual browser results: demo custom suite, five journeys, two journeys with
findings, two occurrences, two signatures. Canonical contradiction replay retains
the target signature. Boundary cap 30 produced no findings in its first 30 cases;
this is correctly described as limited evidence. Fixed-pattern cap 3 ran through
the supported backend branch. Manual 30-day rule custom suite: five journeys,
three with findings, four occurrences, one unique signature.

## C. What-if comparison

Preserved the existing real `/api/diff` integration, explicit fixture/snapshot
selection, scope warnings, cancellation, stale guards and retry. Added a clear
completed status with requested cap and actual journeys per rule set, and report
navigation. Added structured identity metadata for reports, avoiding inference
from display labels or misattribution to the workspace's unrelated active policy.
Memoized request preparation to avoid repeated rule parsing on unrelated updates.

Browser validation: v1/v2 shared five journeys gives two changed events (both
ALLOW→DENY) and five changed rule IDs. Same-rule comparison shows zero changes.
Captured manual revision compared against v1 over one explicitly edited journey.
Definition changes remain distinct from event outcome/resolution changes.
Attribution is candidates/uncertainty, not causal proof; coverage and heuristic
health retain their existing caveats and deliberate local table scrolling.

## D. Reporting

`/workspace/reports` derives available reports from successful, currently scoped
Analyzer, Issues, Stress Testing and What-if results. Viewing a report does not
run another analysis. Each contains analyzed rule sets with origin/revision,
actual scope/caps, execution counters, findings, quotations, readable reductions
where returned, execution evidence, backend Markdown and limitations.

Exports contain exact request/rules and full backend response. JSON includes
schema version, session identity, distinct analyzed identities, default decision,
metrics and caveats. Comparison fixtures have no invented workspace revision;
captured snapshots retain their real revision/fingerprint. Introduced/resolved
finding entries retain their direction/scenario in readable reports and Markdown.
Markdown has a readable summary plus complete reproducible JSON evidence using
safe fencing for embedded backticks. Generated suites do not return every journey;
exports preserve generator parameters and returned examples rather than inventing
missing executions. Reference quotes are not independent grounding guarantees.

Blob URLs support client-side downloads and are revoked on report replacement or
unmount. An initial data-URL implementation timed out in the in-app browser; Blob
downloads fixed the observed problem. Both formats were actually saved and opened:
`Downloads/policyforge-stress-rev-2.json` (8,923 bytes) and `.md` (10,977 bytes),
for **Phase 6 custom refund**, manual revision 2, `manual_refund_1`, five journeys,
three with findings, four occurrences and one signature. No export upload/backend
generation service is involved. Unit tests also parse file serialization.

Changing analysis inputs hides the prior result/report. Activating v2 after the
manual session produced the verified empty-report state; no stale revision was
presented as current. Reports are transient, with no fabricated saved history.

## E. Explainability

Shared simulation results now show actual payload, day, execution index, original
input position, decision/resolution, evaluated/fired/active/suppressed rules,
event findings, condition outcomes, document name/quotation and event-local state.
The documented stable day sort is used only to associate inputs with trace
indices; no decision or detector logic was duplicated in JavaScript.

An unsorted browser input put a day-15 VIP refund before a day-0 delivery. The
first execution event correctly displayed the delivery's `amount_paid:100`, not
the refund payload. Real integration tests verify the event-local before/after
state. Final state remains clearly separate. Unique React-generated heading and
inspection IDs avoid collisions when multiple counterexample replays are open.

## F. UI/UX and component review

New pages reuse semantic surfaces, spacing, typography, badges, 44px controls,
native disclosures, focus indicators and responsive grids. No decorative chart,
remote font/image or new dependency was introduced. Reviewed landing, Analyzer,
Policies and Issues; retained working layouts rather than gratuitous redesign.
Existing navigation, validation, activation and simulation continue functioning.
The final browser pass exposed a client-navigation React exception through the
old `/workspace` server-component redirect (direct reload worked). `/workspace`
now renders the same Issues view directly; its sidebar/title and auto-suite
enablement recognize this alias. Landing entry is verified again after this fix.

| Component | Status after review |
| --- | --- |
| StressTest | Refactored and integrated; exact active policy, explicit runs |
| PolicyDiff | Integrated in What-if; actual response-driven presentation |
| Dashboard | Unmounted prototype, superseded by Issues/current workspace; retained |
| Compiler | Unmounted prototype, superseded by Analyzer; compile method stays locally disabled |
| ProcessGraph | Unmounted illustrative prototype; title explicitly says not a runtime trace |

Import search found no active consumers of Dashboard, Compiler or ProcessGraph.
Useful source was retained. No live compilation action was exposed.

## G. Accessibility and responsive validation

70 layout checks passed: landing plus all six workspace pages × five widths
(1440,1024,768,390,320) × light/dark. Root scroll width never exceeded client width;
theme DOM state matched every case. Technical disclosures were expanded on
Stress Testing/Reports/Issues; comparison tables intentionally scroll locally.
Screenshots cover desktop light and 320px dark for every page.

Browser keyboard checks: native finding disclosure Enter, mobile initial focus,
Shift+Tab wrap to last link, Tab wrap to close button, Escape closure and trigger
focus restoration, and mobile link navigation/automatic dialog closure. Visible
controls retain native labels/semantics and focus outlines; loading/error/status
regions remain announced through the shared primitives. Token contrast and
reduced-motion CSS checks are included in the existing automated suite.

No formal WCAG conformance claim: hardware screen readers, cross-browser behavior,
OS reduced-motion emulation and a full manual AA audit were not verified. Native
selects may truncate the selected label at 320px; full scope is readable below.

## H. Backend handoff

`BACKEND_CONTRACT_FINDINGS.md` now has a prioritized Phase 6 status matrix,
pointing to detailed reproductions/code/expected-vs-actual/fixes/regressions for
all 12 existing concerns. Most significant: invariant signature collisions can
affect suite counts, target shrinking and diff deltas. Unsafe API coercions,
condition-parser extras, duplicate IDs, generator fallback/bounds, attribution,
baseline-biased coverage, null reductions/minimality limits and empty OpenAPI
schemas remain unresolved. Frontend guards and honest labels do not repair them.
The backend owner must coordinate algorithm/shared-contract changes.

## I. Validation results

| Check | Passed | Failed | Skipped / unverified |
| --- | ---: | ---: | --- |
| TypeScript noEmit | 1 | 0 | 0 |
| ESLint | 1 | 0 | 0 warnings |
| Next production build | 1 | 0 | 0 |
| Frontend Node tests | 58 | 0 | 0 |
| Real FastAPI integration | 10 | 0 | 0 |
| Offline backend pytest | 116 | 0 | 2 deselected by instruction |
| Browser workflows A–G | 7 | 0 | Recorded checks, not a committed E2E runner |
| Responsive/theme matrix | 70 | 0 | No root overflow/theme mismatch |
| Keyboard checks | Verified as listed above | 0 observed | Hardware SR/formal AA unverified |

No final validation is blocked. Initial export timeouts and one case-sensitive
SSR-label test failure were corrected before the final passing checks. A sandboxed
Python invocation did not start producing results; rerunning the same excluded
offline suite through the approved local runtime completed in 3.76s.

Counts versus Phase 5: frontend 46→58 (+12 advanced-feature tests); real API
8→10 (+2 stress/report/payload tests); backend remains 116, with the live test and
API compile mock test deliberately deselected. Compiler unit tests use injected
responses and do not execute the prohibited HTTP route or external inference.
No tracked benchmark result was overwritten. Expected network errors occurred
only during the controlled backend outage/server restarts. The entry redirect
exception found during the final pass was fixed and retested. The final landing
→ workspace → stress → reports pass has zero console warnings/errors. A report
DOM check found zero duplicate IDs, unlabelled visible inputs or unnamed buttons.
Browser evidence and the 70-case matrix are saved alongside Phase 6 screenshots
in the task's external visualizations directory (not tracked repository outputs).

Production first-load output: landing 108kB, workspace approximately 140kB versus
134kB in Phase 5. This is build output, not Lighthouse/Core Web Vitals measurement.
No new runtime library. Request preparation and report strings are memoized;
no opaque cross-policy cache or automatic stress/diff/replay was added. Provider
session state preserves navigation and invalidates on active revision changes.

Reproduce from frontend: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:integration` (local FastAPI required), `npm run build`.
Backend: set PYTHONPATH=backend, then Python 3.11
`-m pytest -q -m "not live" -k "not test_api_compile_with_mock"`.

## J. Changed files

Added routes: `app/workspace/stress-test/page.tsx`, `app/workspace/reports/page.tsx`.
Added UI: `screens/ReportsScreen.tsx`, `policy/counterexample.tsx`,
`policy/report-view.tsx`. Refactored `screens/StressTest.tsx`.
Modified UI: `screens/WhatIfScreen.tsx`, `screens/ProcessGraph.tsx`,
`policy/simulation-results.tsx`, `policy/scenario-workbench.tsx`,
`workspace/workspace-provider.tsx`, `workspace/workspace-shell.tsx`,
`workspace/workspace-view.tsx` (all under components).
Also modified the workspace entry route `app/workspace/page.tsx`.
Added libraries: `stress.ts`, `use-stress-test.ts`, `execution.ts`, `reports.ts`.
Modified libraries: `comparison.ts`, `use-policy-comparison.ts`.
Added tests: `tests/advanced-features.test.ts`; extended `tests/offline-api.test.ts`
and package.json test script. Added this report and `NEBIUS_HANDOFF.md`; extended
`BACKEND_CONTRACT_FINDINGS.md`. All paths in this section are frontend-relative.

## K. Git

Started from `019bd15` on `codex/frontend-design-system`. One local Phase 6 stage
commit is intended; the final response records the resulting hash. No push,
merge or branch switch. Pre-existing untracked `.agents/` skills are excluded
from the implementation commit and preserved.

## L. Phase 6.5 Nebius handoff

`NEBIUS_HANDOFF.md` provides inspected client/compiler behavior, explicit
mock/live contract requirements, draft review/activation flow, safe provider
errors, backend-owner approvals, backend-only credentials, retry/repair/fanout
risks, usage completeness and cost accounting. It proposes one explicitly
approved short-clause live call, zero retries/repairs and an initial ceiling
subject to verified pricing/user approval, preserving most of the ~$29.50.
No live setup or test was executed here.

## M. Phase 7 readiness

Deterministic backend tests, frontend contracts/validation/request gates,
simulation/suite/shrink/diff real local tests, report serialization and browser
checklist are ready to rerun. Future integration adds recorded compile-response
tests and live-origin propagation. Live tests must remain explicit opt-in and
excluded from ordinary regressions/CI; backend identity defects need owner work.
