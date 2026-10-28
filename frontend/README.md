# PolicyForge frontend

Next.js 15.5.28, React 18, TypeScript, Tailwind CSS 3, Framer Motion, and Lucide.

Phase 8 adds explicit, guarded NVIDIA compilation to the existing Analyze screen.
See [the integration report](../docs/PHASE8.md) and [deployment preparation](../docs/DEPLOYMENT.md).
Live AI defaults OFF. [Phase 9A](../docs/PHASE9A.md) clears the six recorded dependency
findings; public-service deployment prerequisites remain in the deployment guide.

## Run locally

From this directory, run `npm ci`, then `npm run dev`. The application uses
`NEXT_PUBLIC_API_URL` or `http://localhost:8000` as the backend base URL.

The Python API must be running separately. From the repository root, with the
backend dependencies installed in a Python 3.11 environment:

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
python -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000
```

The public landing page is `/`. `/workspace` redirects to `/workspace/issues`;
`/workspace/analyze` provides opt-in AI compilation, offline structured rule editing, and
scenario execution. `/workspace/policies` displays the active rules; Issues uses
those same rules for real suite and simulation requests. `/workspace/what-if`
compares explicit fixture rule sets or an explicitly captured active-policy snapshot.
Stress Testing and Reports use the same active revision and deterministic results.

`app/workspace/layout.tsx` owns a persistent WorkspaceProvider and WorkspaceShell.
The provider loads fixtures once and retains the editor draft, active policy,
scenario input, and selected suite journeys. Its revision-keyed AnalysisSession
owns `useIssuesAnalysis`, `usePolicySimulation`, and `usePolicyComparison`. Normal workspace navigation
preserves analysis; activation clears previous results and cancels/invalidates
old requests. Changing suite journeys invalidates only that suite, preserving
editor focus and independent scenario results. The first suite starts on entering
Issues. Hard reloads and leaving/re-entering the workspace reset all transient
state and restore the valid NovaCart v1 default. Theme preference persists in
localStorage. Native disclosures and Analyzer trace-step selection reset when
their route unmounts. No database or permanent analysis storage was added.

## Offline analysis

1. Open Analyze Policy and select **Demo Policy** / NovaCart v1 or v2, or choose
   **Custom structured rules** and Add rule / import JSON.
2. Inspect the exact rules, conditions, sources and validation warnings.
3. Activate valid rules. Review the active identity/revision before execution.
4. Select or edit a supported journey and Run Simulation. Inspect actual outcomes,
   findings, fired/suppressed rules, event-local state and the backend explanation.
5. Use Policies for active rule inspection or Issues for the selected sample suite.

In What-if, choose baseline and comparison rules, select shared demo/current
journeys or a clearly labelled limited generated suite, then Compare policies.
Capture active rules to use the current policy as an explicit immutable snapshot.
No automatic comparison or version history is created. Input edits hide old
results; policy activation clears comparison state. Boundary generation is
baseline-only; backend “pairwise” uses fixed patterns. The UI shows both the
requested cap and actual executed count and qualifies attribution/coverage.

The API client uses runtime success decoders, readable structured errors,
AbortSignal support and timeouts (30 seconds for GET/simulate; 60 for suite,
shrink and diff). ApiError exposes kind/status/diagnostics for developers; raw
500 exception details are not displayed to users. GET requests omit Content-Type
to avoid unnecessary CORS preflight. Fixture status does not claim that all
endpoints work. Compile requires an explicit click, per-request consent and a separate
workspace access code; its client timeout is 40 seconds and no retry is automatic.

Typing never triggers extraction. The backend alone holds Nebius credentials.
On explicit Compile, it validates one bounded whole-document extraction; rules
remain a draft until review and activation. Failed/stale responses preserve prior
rules. Demo fixtures are labelled; modifying rules marks them manual. Manual
source text is user-supplied and is not independently verified.
The v2 rule fixture has revised clauses; the document pack remains the original
NovaCart documents and the UI warns about this distinction.

The editor uses closed enums from `backend/policyforge/models.py`, with regression
tests for drift. UI guardrails are stricter than permissive backend coercions:
non-negative typed days/amounts, valid condition values, matching decision/request
triggers, unique IDs, and existing acyclic compatible overrides. Limits: 100 rules,
50 events, eight nested condition levels, 200,000 rule JSON characters, 100,000
scenario JSON characters and 50,000 reference-text characters. State updates and
membership arrays are supported through advanced JSON. No finding is inferred in JS.

The shared native-dialog navigation traps keyboard focus, closes with Escape,
returns focus to its trigger, and closes when resizing to desktop. Desktop
sidebar links expose `aria-current`; the sidebar can be collapsed.

## Frontend checks

```text
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Tests use the existing TypeScript compiler and Node's built-in test runner;
no additional testing package is required. `test:integration` requires local
FastAPI at `http://127.0.0.1:8000` (override `POLICYFORGE_TEST_API` if needed) and
calls health, default-data, simulate, run-suite, shrink and diff. It makes no compile
or LLM requests. `node .test-output/tests/backend-contract-probes.js` prints bounded
raw-backend observations for owner coordination; these are not acceptance claims
for unsafe backend behavior. To run backend regressions without executing compile:
`pytest -q -m 'not live' -k 'not test_api_compile_with_mock'` with backend PYTHONPATH.
Generated test output is ignored.

## Quiet Intelligence design system

- Semantic RGB-channel tokens live in `app/globals.css`; Tailwind exposes them
  with opacity support. Light and dark themes have separately tuned palettes.
- Use `bg-bg`, `bg-surface`, `bg-raised`, `text-text`, `text-muted`, and semantic
  severity colors. `selected-text` supplies accessible text on lavender surfaces.
- Keep Tailwind's standard 4px spacing scale. Prefer even increments for an 8px
  layout rhythm; do not redefine the meaning of existing spacing utilities.
- Local Geist and Geist Mono fonts are loaded with `next/font/local`.
- `components/ui/primitives.tsx` contains the shared Button, Card, Badge, Alert,
  Disclosure, EmptyState, Skeleton, LoadingState, SectionHeader, and StatusIndicator.
- `components/ui/tabs.tsx` implements linked panels, roving focus, arrows, Home,
  and End. Disclosures use native details/summary keyboard behavior.
- Theme preference uses `pf-theme` in localStorage, with OS preference as the
  fallback. A pre-paint script sets the theme before hydration; storage failure
  does not prevent switching. Theme changes do not remount analysis screens.
- Motion is restrained. CSS and MotionConfig respect reduced-motion preferences.

## Scope and remaining work

Phase 5 adds reliable typed API transport and working offline comparison to the
active-policy workspace. Live natural-language extraction, file upload, permanent
history and authentication remain deferred. No new dependencies were added.
Shared backend API contracts and deterministic logic remain
unchanged. Existing unmounted screens need their own review before mounting.

Backend validation, invariant-signature grouping, diff attribution/coverage, and
formal response models remain backend-owner follow-ups from the audit. The UI
does not claim exhaustive policy coverage or globally shortest counterexamples.

See `PHASE5.md` for current verification, `API_CONTRACTS.md` for all seven endpoint
contracts, and `BACKEND_CONTRACT_FINDINGS.md` for teammate coordination. Earlier
phase reports remain historical evidence.
