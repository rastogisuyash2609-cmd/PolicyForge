# Phase 8 mocked browser workflows

Executed through the in-app browser against an isolated loopback frontend/API.
The test API overrides inherited credentials with explicitly offline fixture values,
injects HTTPX MockTransport into the real SDK/compiler, and blocks real sync/async
provider HTTP. No production test route was added.

## Reproduce without credits

From the repository root, using the verified Python environment:

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn browser_mock_api:app --app-dir tests --host 127.0.0.1 --port 8010
```

In a separate shell from `frontend/`:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8010'
$env:POLICYFORGE_TEST_BUILD_DIR = '.next-phase8-e2e'
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3001/workspace/analyze`. The fixture-only access code is
`offline-browser-workspace-access-only`; it is not a provider credential. Never
use real credentials in this harness. This test app must not be publicly deployed.
The `/__offline__/stats` route exists only in this harness and counts mock requests.

## Executed results

| Workflow | Verified result |
| --- | --- |
| Page load + type name/text/access code | Mock provider counter remains 0; Compile disabled until consent |
| Consent + Compile | One mock request; real SDK JSON parsing, Pydantic rules and compiler grounding; draft review shows valid rules and usage; active remains demo revision 1 |
| Activate rules | AI origin and revision 2; correct rule/source labels, immutable active rules |
| Stress Testing | Active AI revision 2, 30 deterministic journeys, 18 journeys with findings, 18 finding occurrences, 1 unique signature; no further provider request |
| Reports | Same active revision/fingerprint, explicit AI provenance/model/request ID/usage, actual stress metrics and Markdown/JSON links; no new provider request |
| What-if | Capture active AI snapshot, compare against NovaCart v1 over 5 shared demo journeys; completed deterministic diff with explicit snapshot identity |
| Invalid response | Append `[offline-invalid]` to the policy; mock returns the recorded dynamic-key condition; local 422, no repair; previous draft rules and active revision 2 retained |
| Stale response | Append `[offline-slow]`, explicitly Compile, then immediately edit text; delayed response is discarded, edited text and active revision 2 remain |

Final harness counter: **3 mock provider attempts** (success, invalid, stale).
Real Nebius HTTP requests: **0**. These are fixture results, not new live inference
or evidence of real provider quality on multi-rule documents. Browser automation
confirmed the UI state; backend and frontend regression tests cover the same guards.

The visual report evidence was saved as `phase8-mocked-report.png` in this task's
local visualization folder and is linked in the completion response. The temporary
mock servers/tabs are cleaned up after verification; production local services use
ports 3000/8000 with live AI disabled.
