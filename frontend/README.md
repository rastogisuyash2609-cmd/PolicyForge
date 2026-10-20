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
`/workspace/policies` displays the existing NovaCart v1 rules. Issues uses real
suite and simulation responses. `/workspace/what-if` is an explicitly unfinished
development route, hidden from primary navigation. Other screens remain unmounted.

`app/workspace/layout.tsx` owns a persistent WorkspaceProvider and WorkspaceShell.
The provider loads fixtures once and owns `useIssuesAnalysis`, preserving the
suite, selected finding, edited journey, simulation result, and selected timeline
step across normal workspace navigation. The first suite starts on entering
Issues. Hard reloads and leaving/re-entering the workspace reset this transient
analysis; theme preference remains in localStorage. Native rule disclosures reset
when their route unmounts. No database or analysis persistence was added.

The shared native-dialog navigation traps keyboard focus, closes with Escape,
returns focus to its trigger, and closes when resizing to desktop. Desktop
sidebar links expose `aria-current`; the sidebar can be collapsed.

## Frontend checks

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Tests use the existing TypeScript compiler and Node's built-in test runner;
no additional testing package is required. Generated test output is ignored.

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

Phase 3 adds the landing page and URL-based workspace, with a server-rendered
marketing page, labelled source-fixture preview, route metadata, and no new
dependencies. Policy submission, upload, history, authentication, and comparison
integration remain deferred. API contracts and backend logic remain unchanged.
Existing unmounted screens need their own design/accessibility pass before mounting.

Backend validation, invariant-signature grouping, diff attribution/coverage, and
formal response models remain backend-owner follow-ups from the audit. The UI
does not claim exhaustive policy coverage or globally shortest counterexamples.

See `PHASE2.md` and `PHASE3.md` for implementation and verification evidence.
