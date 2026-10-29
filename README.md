# PolicyForge

CI/CD for business policies: natural-language policy → structured rules →
deterministic simulation → findings → reduced counterexamples → behavioral diff.
The demonstration domain is NovaCart, a fictional e-commerce refunds/replacements
business. NVIDIA Nemotron via Nebius extracts rules; deterministic Python decides
whether a finding exists.

## Demo workflow

1. Open Analyze Policy and load NovaCart v1 or v2, or enter structured rules.
2. Inspect the rules and source evidence, then activate a reviewed revision.
3. Run a journey or Stress Testing; inspect contradictions, gaps and traces.
4. Replay reduced counterexamples, compare revisions in What-if, and export
   Markdown/JSON reports tied to the active revision.

Live AI defaults **OFF**. A separately authorized compilation requires explicit
consent and a workspace access code; provider credentials stay on the backend.
The public judging release is planned as a deterministic demo without provider
credentials. **No public deployment URL has been verified yet.**

The simple 30-day refund extraction has prior real Nemotron success evidence.
ADV-01 replacement extraction remains **UNCONFIRMED**; other advanced cases are
offline preparations, not claimed live passes. See [live evidence](docs/PHASE9B_LIVE_RESULT.md),
[the investigation](docs/ADV01_STATUS_INVESTIGATION.md), and
[durable future receipts](docs/COMPILATION_EVIDENCE.md).

## Run locally

Requires Python 3.11 and Node.js 22. In a Python virtual environment, from the root:

```powershell
python -m pip install -r backend/requirements-dev.txt
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
$env:POLICYFORGE_ENABLE_LIVE_AI = 'false'
python -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1
```

In another terminal:

```powershell
Set-Location frontend
npm ci
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000'
npm run dev
```

Open http://127.0.0.1:3000. Demo/manual rules need no Nebius key. Keep `.env`,
workspace codes, private evidence, build output and dependencies out of Git.
Never place provider secrets in `NEXT_PUBLIC_*` variables.

## Verify offline

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
python -m pytest tests -q
Set-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Normal backend tests block provider HTTP and exclude the live marker. The latest
backend suite has 335 passing tests; frontend has 63, plus 10 local API tests.
See [Phase 9D preparation](docs/PHASE9D_PREPARATION.md) for current evidence.
The deterministic benchmark
contains 50 executed cases, 49 scored outcome matches, zero mismatches and one
unscored case; see [the recorded release verification](docs/PHASE9C.md) and
`benchmark/phase9c/`. Never enable the LLM benchmark baseline for deployment checks.

## Project layout and deployment

- `backend/policyforge/`: Pydantic IR, compiler, simulator, detectors, shrinking,
  scenarios, diff, API and evidence capture.
- `frontend/`: Next.js, TypeScript and Tailwind workspace.
- `data/novacart/`, `benchmark/`, `tests/`: required fixtures and verification.
- [Manual deployment guide](DEPLOYMENT_GUIDE.md): exact owner-operated Render
  setup, templates, cost, judge instructions, checks and rollback. Nothing deployed.
- [Release checklist](RELEASE_CHECKLIST.md) and [security policy](SECURITY.md).
- [Deployment safeguards](docs/DEPLOYMENT.md): live access and quota limitations.

## License

No open-source license has been selected or added. Repository visibility is public,
but this README makes no open-source licensing grant. Confirm the license choice
with the repository owner/contributors before declaring the project open source.
