# PolicyForge: manual production deployment

Prepared 2026-10-29. **No deployment, cloud resource, purchase, push, merge or live
inference has been performed.** You choose hosting and execute deployment yourself.
Local root `.env` stays unchanged. Use the final local release SHA, not an older
reported commit. This guide does not authorize any paid inference.

## 1. Hosting and release scope

Recommend **Render**, with managed HTTPS and generated `onrender.com` hostnames:

| Component | Proposed choice | Monthly baseline |
| --- | --- | ---: |
| Workspace | Hobby | $0 |
| Frontend | Static Site, exported Next.js | $0 |
| FastAPI | Paid 512 MB / 0.5 CPU, one instance | $7 |
| Private evidence disk | 1 GB | $0.25 |
| Total | Before taxes/usage overages | **$7.25** |

List prices checked 2026-10-29: [pricing](https://render.com/pricing),
[static sites](https://render.com/docs/static-sites),
[disks](https://render.com/docs/disks). Confirm dashboard pricing before purchase.
No VM, domain purchase, Kubernetes or extra database is needed for this initial
live-OFF release. Free API compute sleeps and lacks persistent disks, so is not
the recommended judge-facing configuration. Hosting is separate from Nebius;
the historical $29.50 starting balance is not a verified current balance.
[Railway](https://docs.railway.com/pricing/plans) is an alternative with a $5/month
minimum and usage charges above included usage; these steps use Render only.

Initial public release: **deterministic demo, no provider/workspace credentials**.
Judges use NovaCart v1/v2 or structured manual rules, activate revisions, simulate,
stress test, inspect/replay counterexamples, compare policies and export reports.
The AI editor remains visible but public Compile is unavailable with a clear 503.
Prior real simple-refund AI success is documented; ADV-01 stays UNCONFIRMED.

## 2. Personally review/publish the source

Repository: https://github.com/Sj-dev90/PolicyForge. Development branch:
`codex/frontend-design-system`. In PowerShell:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
git status --short
git log -1 --oneline
git diff --check
git fetch origin
git log --oneline origin/main..HEAD
```

Review the release commit. Preexisting `.agents/` is excluded from this release;
never add root `.env`, private receipts, dependencies or build output. When you
personally decide to publish the reviewed branch:

```powershell
git push -u origin codex/frontend-design-system
```

Codex has not executed this push. Do not force push. You can deploy the branch
directly; PR/merge into main is optional and needs your review. Keep Auto-Deploy
Off. A PR template and RELEASE_CHECKLIST.md are prepared.

The checked GitHub account has push but not admin permission. Repository owner
`Sj-dev90` may need to approve Render's GitHub App for this repository. If access
is missing, obtain owner approval; do not automatically transfer/copy the project.
No LICENSE exists: confirm the owner/contributors' choice before claiming an
open-source grant. Public visibility is not a license.

## 3. Verify Linux before public release

After your push, open GitHub → repository → **Actions → Offline release checks**.
Inspect the job for your exact SHA, or choose Run workflow. Prepared CI uses
Ubuntu, Python 3.11, Node 22, backend/frontend tests, type/lint/static build, real
loopback public-mode API tests and dependency audits. **Do not add Nebius or
workspace secrets to CI.** Package/advisory downloads use network access; ordinary
backend tests block real provider HTTP and exclude the live test marker.

Native Linux execution is **not verified by this Windows preparation**. Linux
wheel resolution and Linux SWC lock entries are not Linux runtime results. Do not
silently skip a failing CI/build/audit. Equivalent Linux preflight commands:

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.txt
export PYTHONPATH=backend POLICYFORGE_ENABLE_LIVE_AI=false POLICYFORGE_PUBLIC_DEMO=false
python -m pytest tests -q
cd frontend
npm ci
npm test
npm run typecheck
npm run lint
POLICYFORGE_STATIC_EXPORT=true NEXT_PUBLIC_API_URL=https://api.example.invalid npm run build
npm audit --audit-level=low
```

The example.invalid URL is intentionally non-working, for build checks only.
Published output needs the actual backend HTTPS origin. Never export over a
running `.next` server build: Next still uses `.next` internally despite a custom
export directory. Build in CI/a clean checkout, or stop/restore the local frontend.
Do not copy Windows node_modules onto Linux; use npm ci with the lockfile.

## 4. Manually create the backend

1. Open https://dashboard.render.com/register; sign in, choose personal Hobby,
   and complete account/payment decisions yourself.
2. Choose **New → Web Service → Git Provider**, authorize only the required repo,
   and select PolicyForge's reviewed release branch.
3. Enter the following. **Root Directory must be blank**, so data/ and benchmark/
   remain available alongside backend/.

| Setting | Value |
| --- | --- |
| Name | Available name, e.g. policyforge-api |
| Branch | Reviewed release branch |
| Root Directory | Blank: repository root |
| Runtime | Python 3 |
| Build | `pip install -r backend/requirements.txt` |
| Start | `python -m uvicorn policyforge.api:app --host 0.0.0.0 --port $PORT --workers 1 --limit-concurrency 8 --backlog 32 --timeout-keep-alive 5 --no-server-header` |
| Health Check | `/api/health` |
| Compute | Paid 512 MB / 0.5 CPU; one instance |
| Auto-Deploy | Off |
| Disk | 1 GB; mount `/var/data/policyforge` |

4. Enter values from `deploy/backend.env.example` in Environment. If the frontend
   URL is not assigned yet, temporarily use `https://frontend-pending.example.invalid`
   for CORS; it permits no real frontend. Correct it in step 5 before judging.
5. **Do not upload root .env. Omit NEBIUS_API_KEY, OPENAI_API_KEY and
   POLICYFORGE_COMPILE_TOKEN entirely** from the public host.
6. Confirm PUBLIC_DEMO=true, ENABLE_LIVE_AI=false, AI_REQUEST_BUDGET=1,
   MAX_RETRIES=0, timeout 30.0, blank LIVE_TEST_ID and private evidence directory.
   Use the full POLICYFORGE_* names from the template.
7. Review the displayed cost; personally click **Create Web Service** when ready.
   Wait for build/health and save the actual assigned HTTPS origin.

`.python-version` selects Python 3.11 instead of Render's newer default minor.
Record the resolved patch. Requirements constrain the audited production dependency
closure; preserve backend/constraints.txt. [Python selection](https://render.com/docs/python-version),
[FastAPI setup](https://render.com/docs/deploy-fastapi).

Only the mounted path persists across Render redeploys. Keep private backups and
restrict team/shell access. No receipt is publicly served. A disk preserves evidence,
**not a durable paid quota**. Never deploy tests/browser_mock_api.py.

## 5. Manually create the frontend and finish CORS

Choose **New → Static Site** with the same repo/reviewed branch:

| Setting | Value |
| --- | --- |
| Name | Available name, e.g. policyforge |
| Root Directory | **Blank**, not frontend |
| Build | `cd frontend && npm ci && npm run build` |
| Publish Directory | `frontend/out` |
| Auto-Deploy | Off |

The landing page imports data/novacart outside frontend; both services need the
repository root. Set the values from deploy/frontend.env.example:

```dotenv
NODE_VERSION=22.x
SKIP_INSTALL_DEPS=true
POLICYFORGE_STATIC_EXPORT=true
NEXT_PUBLIC_API_URL=https://ACTUAL-BACKEND.onrender.com
```

Leave POLICYFORGE_TEST_BUILD_DIR unset. NEXT_PUBLIC_API_URL must be the actual
HTTPS origin with no `/api`, credentials, query or fragment. It is public and
embedded at build time; changing it requires a rebuild. The static build rejects
missing/insecure/path-bearing origins. No secret belongs in frontend settings.
Linux x64 SWC 15.5.28 is present in the npm lockfile.
[Node selection](https://render.com/docs/node-version),
[Render Next.js](https://render.com/docs/deploy-nextjs-app),
[Next static export](https://nextjs.org/docs/app/guides/static-exports).

Create the site yourself and copy its actual HTTPS origin. Update backend
POLICYFORGE_CORS_ORIGINS to that exact origin, **without a trailing slash**, then
manually deploy the backend environment change. Keep live false and public demo
true. This procedure never starts a live-enabled worker.

In Static Site **Redirects/Rewrites**, add these **Rewrite** rules if clean deep
links are not already resolved correctly. Inspect the actual export first:

| Source | Destination |
| --- | --- |
| `/workspace` | `/workspace.html` |
| `/workspace/analyze` | `/workspace/analyze.html` |
| `/workspace/policies` | `/workspace/policies.html` |
| `/workspace/issues` | `/workspace/issues.html` |
| `/workspace/what-if` | `/workspace/what-if.html` |
| `/workspace/stress-test` | `/workspace/stress-test.html` |
| `/workspace/reports` | `/workspace/reports.html` |

Do not add `/* → /index.html`. Preserve `_next/` assets and exported route `.txt`
payloads. Verify client navigation AND direct refresh on every route; unknown
routes should remain 404.

In the site's Headers panel on `/*`, set `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and
`Permissions-Policy: camera=(), microphone=(), geolocation=()`. Verify responses.
Keep managed HTTPS; do not add an untested CSP that blocks Next scripts/styles.

## 6. Access controls and judge instructions

Public demo mode is server-side and independent of frontend consent/CORS:

- ALL `/api/compile` requests, even mocks, return 503 before compiler/SDK work,
  including when live AI was accidentally set true.
- Global per-worker limits: **120 reads/minute, 30 writes/minute, two active write
  requests**. Excess requests get 429/Retry-After; health/preflight are exempt.
  Counts do not trust spoofable forwarded IP headers. Concurrent judges share limits.
- Bodies ≤1 MB; 100 rules/revision, 50 events/journey, 200 custom scenarios,
  suite execution limit 1..200, 8 condition levels, 2,048 combined condition nodes,
  32 distinct day thresholds, JSON depth 32 and 50,000 JSON nodes. Excess workloads
  are rejected, never rewritten into different business rules. Pydantic/engine
  semantics remain unchanged.
- Exact HTTPS CORS origins are required. CORS is not authentication or a firewall.
- Existing paid compilation remains available only in a separately approved
  operator environment: workspace Bearer authorization, explicit consent/live flag,
  UUID idempotency, one active compile, two attempts/minute, process hard budget,
  1536 output tokens, 30-second timeout, zero SDK/HTTP/wrapper retries, zero repairs
  and fallbacks. This guide does not authorize configuring it or running a test.

Application limits plus provider network protection reduce abuse; they do not
guarantee DDoS resistance or establish measured 512 MB load capacity. Monitor
memory/latency and hosting spend. If access must be judge-only, use a verified
identity-aware gateway across frontend/API. Do not share keys in URLs. Any larger
compute/extra service is your spending decision, not an automatic upgrade.

**No durable shared paid quota is implemented.** Restart resets process counters;
workers/instances multiply them. Receipt UUID protection is not a credit ledger.
Keep live inference OFF on this public host. Before any paid public/multi-instance
launch, add atomic durable quotas/idempotency, authenticated identities and provider
spend controls, or verified restricted operator-only network access with separately
authorized tests. Never restart to bypass a consumed live allowance. External or
teammate account usage is outside application accounting.

Give judges the frontend HTTPS URL and this walkthrough:

1. Analyze Policy → Demo Policy → load NovaCart v1; review rules/source and activate.
2. Check active revision; run a sample journey and Stress Testing with 30 cases.
3. Open Issues; inspect a contradiction and replay its minimal counterexample.
4. Compare with NovaCart v2 in What-if over shared scenarios.
5. Download Markdown/JSON Reports tied to the active revision and exact inputs.
6. Do not enter personal data/provider keys/workspace codes. Public AI Compile is
   disabled; README links the prior real AI evidence and current coverage limits.

Browser drafts/analysis are session state, not durable server accounts. Export
reports before refreshing; refresh/redeploy can clear transient UI results.
Activating/replaying demo rules never calls Nebius.

## 7. Verify actual hosted URLs without inference

No actual public URL has been verified during preparation. Replace placeholders:

```powershell
$apiOrigin = 'https://ACTUAL-BACKEND.onrender.com'
$siteOrigin = 'https://ACTUAL-FRONTEND.onrender.com'
Invoke-RestMethod "$apiOrigin/api/health"
(Invoke-WebRequest "$apiOrigin/api/default-data").StatusCode
(Invoke-WebRequest "$siteOrigin/workspace/analyze").StatusCode
```

In a Bash shell, set API and SITE to the actual origins, then:

```bash
curl -i -X OPTIONS "$API/api/simulate" -H "Origin: $SITE" -H 'Access-Control-Request-Method: POST'
curl -i -X OPTIONS "$API/api/simulate" -H 'Origin: https://untrusted.example' -H 'Access-Control-Request-Method: POST'
curl -i "$API/api/compile" -H 'Content-Type: application/json' -d '{}'
```

Expect allowed preflight 200/exact allow header; untrusted preflight 400/no allow
header; Compile 503/live_disabled with zero provider work. Do not send keys or
authorization headers. Never execute the live smoke script for release checks.

Repeat the judge walkthrough and refresh each direct route. Verify assets/fonts,
reports/downloads, source traces, failed/stale compilation preserving active rules,
and the CORS/header checks. A manual 30-day refund fixture should allow days 0/30;
day 31 uses the existing default-deny/policy-gap semantics, not an invented deny rule.
Check private disk mounting/writability in Render Shell. Test persistence only
using clearly labeled offline fixtures; do not fabricate a real successful receipt.
Evidence reading instructions in docs/COMPILATION_EVIDENCE.md require no inference.

Record release SHA, resolved Python/Node/npm versions, audit date, real URLs,
health/CORS/Compile-denial results and walkthrough evidence. Repeat audits against
the actual host environment; only then submit its URLs for judging.

## 8. Troubleshooting, rollback and owner decisions

- Missing fixture/module: keep both Root Directory fields blank.
- Frontend contacts localhost: correct public API origin and rebuild the static
  site; backend env changes alone do not change its embedded URL.
- CORS: exact HTTPS origin, no slash/wildcard; verify backend redeploy.
- Deep-link 404: verify frontend/out and precise rewrites, not an SPA fallback.
- 429: wait ≥60 seconds, retry deterministic work manually; no inference retry loops.
- Build/audit/health failure: withhold submission and inspect sanitized logs.
  Never paste keys, authorization headers or environment dumps.
- Memory pressure: lower suite size/measure usage, then personally consider larger
  compute. Do not silently add replicas or workers.

Keep Auto-Deploy Off. Use each service's Events/Deploys to select the previously
verified deploy/commit, or manually deploy that SHA. Recheck env/CORS/rewrites:
code rollback does not necessarily roll back configuration or disk contents.
Keep public mode true, live false and credentials absent during rollback. Private
receipts/backups are separate from Git; never reset paid budgets to retry.

Your remaining actions: choose hosting/cost, authorize repository integration,
personally publish the reviewed branch, decide licensing where needed, observe
Linux CI, create services and verify actual HTTPS behavior. No purchase, public
deployment or new inference is implicit in this preparation.
