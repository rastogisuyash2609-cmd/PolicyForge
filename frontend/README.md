# PolicyForge frontend

Next.js 14, React 18, TypeScript, Tailwind CSS 3, Framer Motion, and Lucide.

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
`/workspace/analyze` provides offline policy input, structured rule editing, and
scenario execution. `/workspace/policies` displays the active rules; Issues uses
those same rules for real suite and simulation requests. `/workspace/what-if` is
an explicitly unfinished development route, hidden from primary navigation.
Other screens remain unmounted.

`app/workspace/layout.tsx` owns a persistent WorkspaceProvider and WorkspaceShell.
The provider loads fixtures once and retains the editor draft, active policy,
scenario input, and selected suite journeys. Its revision-keyed AnalysisSession
owns `useIssuesAnalysis` and `usePolicySimulation`. Normal workspace navigation
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

Policy text is reference material only. No automatic prose extraction, mock
compilation, Nebius configuration, credential access, or external inference is
performed by this workflow. Demo fixtures are labelled; modifying rules marks
them manual. Manual source text is user-supplied and is not independently verified.
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
calls only default-data, simulate and run-suite. It makes no LLM requests.
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

Phase 4 adds offline policy input, manual rules, active policy management, and
deterministic analysis to the routed workspace. Live natural-language extraction,
file upload, permanent history, authentication, and comparison integration remain
deferred. No new dependencies were added. API contracts and backend logic remain
unchanged. Existing unmounted screens need their own review before mounting.

Backend validation, invariant-signature grouping, diff attribution/coverage, and
formal response models remain backend-owner follow-ups from the audit. The UI
does not claim exhaustive policy coverage or globally shortest counterexamples.

See `PHASE2.md`, `PHASE3.md`, and `PHASE4.md` for verification evidence.
