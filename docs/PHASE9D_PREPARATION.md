# Phase 9D production preparation — owner-operated deployment

Prepared 2026-10-29 from b8eb313, branch codex/frontend-design-system. Scope changed
to preparation only. No cloud account/resource, purchase, push, merge, deployment
or paid/provider inference occurred. Local root .env was not modified. Backend
on 8000 remains live-disabled; no active browser rules were changed.

## Changes

- Opt-in static Next.js export with fail-fast HTTPS API-origin validation; normal
  Next.js server builds remain available. New public/local env examples contain
  no credentials. Render source root must remain the full repository for BOTH
  services because the frontend imports data/novacart outside frontend/.
- New backend PublicDemoGuard, installed inside CORS and outside body decoding.
  Enabled only by POLICYFORGE_PUBLIC_DEMO=true; blocks all compile paths before
  SDK construction even if live mode was accidentally enabled. Local defaults
  and separately authorized operator integration are unchanged.
- Bounded deterministic workloads/rates/concurrency, rejecting excess work without
  changing IR/engine semantics: 100 rules/revision, 50 events/journey, 200 scenarios,
  execution limit 1..200, condition depth 8, combined condition nodes 2048,
  32 day thresholds, JSON depth 32 / 50,000 nodes, 1 MB body; 120 reads/minute,
  30 writes/minute, two active writes per worker. Health/preflight exempt.
- Production dependency constraints from the audited 24-package runtime closure,
  Python 3.11 selection, Ubuntu offline CI with no provider secrets, PR template,
  README, SECURITY.md and RELEASE_CHECKLIST.md.
- Root DEPLOYMENT_GUIDE.md: manual Render account/repo/service setup, cost,
  exact environments/build/start/root/publish fields, CORS, route rewrites,
  storage/access, judge walkthrough, actual-host verification and rollback.

## Actual local results

| Check | Result |
| --- | --- |
| Full backend offline suite | **335 passed, 0 failed; 1 live test deselected**, 5.81 s (final CI-environment recheck) |
| New public demo boundary tests | **29 passed**, included in 335; not double-counted |
| Frontend unit suite | **63 passed, 0 failed** |
| Real local public-mode API integration, port 8011 | **10 passed, 0 failed** |
| Combined tests | **408 passed, 0 failed** |
| Explicit TypeScript | PASS |
| ESLint | PASS; upstream next lint deprecation notice only |
| Windows normal production build | PASS; running loopback frontend restored |
| Windows isolated static production export | PASS, **12 generated pages** |
| Full / production npm audits | **0 vulnerabilities** |
| Actual Python environment audit | **0 known vulnerabilities**, 32 installed packages |
| Installed Python dependency compatibility | No broken requirements |
| Linux x64/Python 3.11 wheel resolution | PASS, all **24** production packages downloaded |
| Native Linux execution | **Not performed**; no installed WSL distro/Docker |
| Public HTTPS/hosting checks | **Not performed**; nothing deployed |

The temporary 8011 process uses the real application with public mode ON and live
mode OFF. Its API tests cover fixture loading, activation contracts, suite/report
data, intermediate states, invalid IR rejection, canonical shrinking/replay and
What-if comparison. Public boundary tests also cover accidental live opt-in,
compile/mocks blocked, malformed/deep/nonfinite JSON, workload bounds, rate expiry,
spoofed forwarding, CORS errors, concurrency and slot release after failures/cancel.
No inference-shaped successful HTTP response is labeled real provider evidence.

The local API run emitted the existing Pydantic serializer warning for a VIP
string assigned to the customer_tier enum field. Its JSON value and regression
assertions passed; this non-blocking warning was observed, not hidden or treated
as a new engine fix. The deterministic engine was left unchanged.

The initial disposable static-source build failed because its copied source lacked
the required sibling data/ directory. Adding that fixture directory made the build
pass and exposed the full-repository hosting-root requirement. An earlier static
experiment also used .next internally despite a custom export directory; the normal
frontend was restored/restarted with the loopback API origin. Final static build
used an isolated source copy, not the running production output. No failing check
was silently ignored or interpreted as Linux success.

Audit JSON and machine-readable readiness evidence are under
release_preflight_2026-10-29/. Only configured current secrets/private-key markers
were scanned; zero matches is not proof that every possible historical secret is
absent. Private evidence/build/dependency directories remain Git-ignored.

## Deployment status and limitations

Recommended Render baseline: free static frontend + $7 paid API + $0.25 private
1 GB disk = **$7.25/month before taxes/overages**, subject to owner dashboard review.
No hosting charge or Nebius balance has been inferred/approved here.

Preparation is ready for the owner's release process, **not an assertion of full
public production verification**. Owner must publish the reviewed branch, complete
Linux CI/target checks, authorize repository integration, choose license terms if
needed, create services personally, and verify real HTTPS/CORS/routes/headers/
volume/workflows before judging. Windows build/wheel availability cannot replace
these checks. Capacity has not been load-tested on 512 MB compute.

Persistent evidence is implemented; durable shared paid quotas are not. Public
demo mode must stay ON, live mode OFF, and provider/workspace credentials absent.
Paid public/multi-instance access remains blocked pending atomic durable quotas,
identity/account spending controls or verified restricted operator-only access.
Existing process budgets reset on restart and never represent the shared account
balance. No worker was restarted live-enabled to replenish a request allowance.

Prior simple-refund live success remains documented. ADV-01 stays UNCONFIRMED;
no advanced live category was rerun. No deterministic-engine or IR schema behavior
was changed. Existing 50-case benchmark artifacts remain intact; benchmark unit
coverage runs in pytest, but no new full benchmark/baseline was claimed here.
