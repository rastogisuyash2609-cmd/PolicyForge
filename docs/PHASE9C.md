# Phase 9C: final verification, deterministic benchmark and release readiness

Completed locally on 2026-10-29 from 886e090. **Zero live Nebius API/inference
requests in this phase.** The real backend remained live-disabled, its root .env
was not edited, and no smoke execution, live baseline, paid policy batch, push,
merge, deployment or Phase 9D operation occurred.

## Final regression results

| Check | Passed | Failed | Notes |
| --- | ---: | ---: | --- |
| Full backend pytest | **240** | **0** | 1 live test deselected by the existing default marker |
| Frontend unit tests | **63** | **0** | All configured test modules |
| Real loopback API integration tests | **10** | **0** | Deterministic API, counterexample replay and report evidence |
| Explicit TypeScript check | PASS | 0 | tsc --noEmit --incremental false |
| ESLint | PASS | 0 | No application warnings/errors; upstream next lint deprecation notice remains |
| Production build | PASS | 0 | All 12 static pages generated with Next 15.5.28 |
| Clean npm ci | PASS | 0 | Verified after removing redundant Windows direct SWC dependency |
| Full npm audit | **0 vulnerabilities** | 0 | SECURITY_AUDIT_PHASE9C_NPM.json |
| Production npm audit | **0 vulnerabilities** | 0 | SECURITY_AUDIT_PHASE9C_NPM_PRODUCTION.json |
| Actual Python 3.11 environment audit | **0 known vulnerabilities** | 0 | 32 installed production/development packages; SECURITY_AUDIT_PHASE9C_PYTHON.json |

There are **313 passing tests across the three final suites**, not counting
benchmark scenarios as unit tests. An additional focused benchmark-module recheck
passed 22 tests already included in the 240; do not double-count them. The initial
backend run had 236 passes before four new CLI credit-safety tests were added;
the final full result is 240. No failed test was hidden or deselected.

## Confirmed end-to-end behavior

The real production frontend on 3000 and FastAPI on 8000 were checked with live AI
OFF. Browser inference-shaped requests ran only against the existing isolated
test harness on 3001/8010. It replaces inherited credentials with fixture values,
injects SDK MockTransport and blocks real sync/async provider HTTP. Its compile
feature path is exercised with mocks; the production live flag was never enabled.

| Browser workflow | Observed result |
| --- | --- |
| Load and type policy/name/access fixture | Mock counter 0, Compile disabled until explicit consent |
| Explicit mocked Compile | One SDK-shaped mock response; Pydantic/grounding pass, one rule with item_delivered IS_TRUE and days_since_delivery LTE 30; draft review before activation |
| Activate | AI-origin revision 2, fingerprint 9aa1001c; old demo revision 1 replaced only on explicit activation |
| Simulate refund day 0 | ALLOW, no supported finding |
| Simulate refund day 30 | ALLOW, inclusive bound |
| Simulate refund day 31 | DEFAULT_DENY, no rule fired, POLICY_GAP; this is the simulator fallback, not an extracted explicit denial rule |
| Stress Testing | Active revision 2; 30 journeys, 18 journeys with findings, 18 occurrences, 1 unique signature |
| Reports | Simulation and stress entries available; selected stress report retains revision/fingerprint, exact rules/source, actual deterministic metrics and fixture extraction provenance; Markdown/JSON links present |
| What-if | Captured active AI snapshot versus NovaCart v1 over 5 shared journeys; completed comparison |
| Invalid mocked compilation | Local validation error, no retry/repair; previous compiled draft and active revision 2 retained; activation of edited/unvalidated prose blocked |
| Stale mocked compilation | Edit while delayed response pending; late response discarded, edited text and active revision 2 retained |
| Activate a different demo | NovaCart v1 becomes revision 3, analysis reset for new active rules |
| Contradiction and counterexample replay | Issues runs 5 known journeys, 2 finding signatures. The conflicting refund rules show a 4-step reduced journey with refund day 31. Browser replay returns Denied · conflicting rules |

Final browser harness counter: **3 mocked provider-shaped attempts** (success,
invalid and stale), **0 real provider requests**. Unexpected browser warning/error
log was empty when inspected before the final replay completed. HTTP 422 for the
intentional invalid fixture is an expected response, not an unexplained failure.
The temporary tab and mock servers were stopped after verification. Only the
normal local production frontend was rebuilt/restarted; the real live-OFF backend
was not restarted or modified. No existing user tab was reloaded or edited.

Frontend and local API regression assertions verify Markdown/JSON contents,
reproducible rule/request/result associations, active revision preservation and
counterexample signature replay, in addition to the browser's export controls.
Browser evidence is saved in the task's visualization folder as phase9c-report.png
and phase9c-counterexample.png. Displayed extraction usage in those images is
**mock fixture data**, never the missing Phase 9B billing record.

## Six-category coverage: live versus offline

All six fixture categories pass Pydantic/closed-vocabulary/grounding and engine
checks in the full suite. See STAGE2_POLICY_CASES.md for exact inputs and criteria.

| Category | Phase 9C offline result | Real Nemotron evidence |
| --- | --- | --- |
| Simple inclusive refunds | PASS, days 0/30 allow; day 31 no applicable allow | Third CLI smoke success and owner-performed Phase 9B frontend success for this one synthetic policy |
| Damaged replacement eligibility | PASS | Mock/fixture only |
| Refund after replacement cancellation | PASS | Mock/fixture only; not general order cancellation coverage |
| Combined refund/replacement | PASS | Mock/fixture only |
| Strict LT 30 boundary | PASS | Mock/fixture only |
| Ambiguous language | PASS for fixture rejection without invented duration | Mock/fixture only; real model safe-failure behavior not established |

No claim that all six live cases passed. Phase 9B exact frontend input/output token
usage and billing remain **unavailable/pending**. The owner-reported $29.50 balance
and 1304/2384/3688 tokens with $0.00065040 listed cost belong to the first three
CLI tests only. They are not reattributed, extrapolated or refreshed in this phase.

## Actual deterministic benchmark

The available labeled suite contains **50 cases**, not 300. The existing runner
evaluated every case using NovaCart v1 fixture rules; the LLM baseline was skipped.
HTTPX sync/async and socket connection guards surrounded the whole verification,
with **0 network attempts and 0 provider requests**. Results are saved separately
from historical artifacts in benchmark/phase9c/:

- results.json: raw runner results/metrics with baseline=null.
- report.md: existing runner's Markdown report.
- verification.json: coverage, signature-preserving counterexamples/replay,
  explicit refund boundaries, timing and limitations.
- suite.md: existing deterministic suite/shrink summary.

| Benchmark measurement | Actual result |
| --- | --- |
| Cases available / executed | **50 / 50** |
| Outcome labels scored | **49** |
| Outcome labels matched / mismatched | **49 / 0**; 100% on the 49 scored cases |
| Cases without an outcome score | **1**, ls_049; no outcome expectation, not a skipped execution |
| Journeys without / with diagnostic findings | **47 / 3**; these are diagnostic states, not label-accuracy failures |
| Finding occurrences | **3**: 1 CONTRADICTION, 1 POLICY_GAP, 1 INVARIANT_VIOLATION |
| Journeys containing contradictions | **1** |
| Unique finding signatures | **3** |
| Counterexamples generated / replayed successfully | **3 / 3**, domain-valid and preserving type plus rule-ID signature |
| Rules fired at least once | **12 / 12**, 100% in this suite |
| Event types observed | **12 / 12**, 100% in this suite |
| Distinct decision-resolution transitions observed | **4**; no exhaustive-transition percentage asserted |
| Runner wall time including imports/output | **1.528774 seconds** |
| Runner + supplementary coverage/shrink/replay wall time | **1.571199 seconds** |
| Average per-case simulation latency | Approximately **0.21 ms** in stdout; saved summary rounds this to 0.2 ms |
| Provider tokens | **0** |

The runner's consistency=100% is by design, not an independently sampled LLM
consistency measurement. No ambiguity finding cases are labeled in this suite;
its zero-support ambiguity metrics are not evidence that ambiguity detection is
fully evaluated. Full rule/event coverage is not branch, state-space, semantic or
real-world completeness. Coverage counts fired rules even when later suppressed.
Supplementary simulation/shrinking/replay calls do not increase the 50-case count.
Counterexamples preserve the current signature; distinct invariant failures can
share it, and global shortestness is not established. Algorithms/labels were not
changed to improve the reported score.

The prior Phase 8 payload-assignment/serializer caveat (a VIP tier string in an
engine state) remains existing technical debt; the corresponding local API test
passes. No engine/type-assignment rewrite was made during this release check.

Reproduce with the verified Python 3.11 runtime:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
& ./docs/reproduce_phase9c_benchmark.ps1
```

The checked-in PowerShell evidence script executes the existing runner with
--engine-only under network guards, then calls the existing coverage/suite/shrink
interfaces. Timings will vary. The direct deterministic command is also:

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
$env:POLICYFORGE_ENABLE_LIVE_AI = 'false'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' benchmark/run_benchmark.py --engine-only --output-dir benchmark/phase9c
```

## Security findings and minimal fixes

**Fixed credit hazard:** the legacy benchmark previously defaulted to paid baseline
evaluation whenever an API key was present, independently of the API gate. It now
defaults to deterministic-only even if credentials/live environment are present.
A paid baseline requires explicit --live-baseline AND environment opt-in; conflicting
mode flags fail. Four offline tests prove the safe default and flag gate. No live
baseline was run. The legacy baseline remains outside API session quotas and must
not be used as a deployment health check or without separate batch authorization.

**Fixed Linux install blocker:** removed the direct @next/swc-win32-x64-msvc
dependency. The only lockfile change is removing that root entry and marking the
Windows package optional. Next selects platform-specific SWC; versions, application
components and design are unchanged. Clean Windows install/build pass. Linux runtime
execution remains unverified because neither WSL nor Docker is installed here.

Verified unchanged controls: default live flag OFF; backend-only provider key;
separate server-validated workspace code (minimum 24 characters, distinct from key);
16 KiB compile and 1 MB other POST body caps; 4000 characters/one document/8 rules;
one concurrent compile, two attempts/minute, configured process attempt budget;
UUID and content deduplication; one provider request, 1536 output tokens, 30-second
per-operation timeout; zero SDK/wrapper/transport retries, repairs and fallbacks.
No compile on page load, typing, health, build, navigation or automated real-provider
transport. Tests use mocks and reject real HTTPX transports. API request validation,
provider exceptions and credential echoes are sanitized. CORS uses exact origins
without credential wildcard. Root .env remained ignored/untracked and unchanged.

The saved SECURITY_PREFLIGHT_PHASE9C.json records **117 build/public files and
285 total files scanned**, zero matches for either configured credential, zero
frontend secret-environment reads, and a Git-ignored/untracked root .env. Both
normal local health/page GETs returned 200. The real disabled backend stayed PID
40900; temporary fixture servers were stopped. npm reported
deprecation notices for ESLint 8 and old transitive dev packages; full/production
audits nevertheless return zero known vulnerabilities. No unnecessary major
toolchain upgrade was made. Audit scope excludes the OS, Node runtime binary,
Caddy and future Linux-specific dependency resolution; repeat on the target host.

## Remaining production blockers and deployment readiness

**Ready locally:** full Windows regression, deterministic benchmark, mock-backed
workflow and dependency audits. One real frontend extraction is historically
confirmed, with billing pending. No new live validation was necessary or authorized.

**Not yet verified/released:** native Linux install/build/API tests, deployed TLS,
DNS, gateway access controls and target-host advisory scans. No domain, host or judge
allowlist is configured by this phase. Python direct pins do not freeze all target
transitives. The installed local Node runtime was tested but not certified as the
current security-patched runtime for a public host.

**Unrestricted public live AI remains blocked** by process-local budget/idempotency
resets, no account-global persistent allowance, shared operator token rather than
per-user identity, and no gateway-wide CPU/rate protection for deterministic routes.
CORS alone does not protect an API. Body limits and paid-route throttles do not
solve anonymous deterministic workload abuse. Root account balance/credit expiry
and the requested $20.50 reserve are not enforced by a local request counter.

Production-safe choices: (1) restricted single-instance demo with live AI OFF and no
provider secret on the host; (2) separately authorized operator-only paid window,
budget=1, no automatic restart, provider-account spend controls and access restriction;
or (3) durable atomic shared quota/idempotency store, per-user auth, per-user/global
limits, gateway abuse controls and a usage ledger before multi-instance public live AI.
None of the persistent quota/auth infrastructure is claimed implemented here.

The fastest recommended first hosting path is **one restricted Linux VM**, same-origin
TLS proxy, loopback Next/FastAPI, one backend worker and live AI OFF. It avoids adding
multi-instance quota complexity before judging. Exact proposed commands, environment,
systemd units, Caddy allowlist/TLS, Linux release gate, verification and rollback are
in [PHASE9D_DEPLOYMENT.md](PHASE9D_DEPLOYMENT.md). They are unexecuted preparation.

## Exact next steps for Phase 9D

1. Owner reviews/approves the local release commit, host/account, domain, allowed
   operator/judge CIDRs and deployment scope. No permission to deploy is inferred.
2. Provision a patched Linux host with Python 3.11 and supported Node 22/Caddy;
   transfer only reviewed tracked source, excluding .env and other local artifacts.
3. Execute the runbook's Linux clean install, all regressions, target Python/npm
   audits and production build. Stop on any failure before enabling ingress.
4. Start one live-OFF API worker and Next production service on loopback; verify
   health, fixtures, disabled compile gate and local API tests without a provider key.
5. Validate the TLS proxy, approved-source access, rejection from an unlisted source,
   CORS and closed direct application ports. Run deterministic judging workflows and
   report exports. Live testing/public paid access require separate explicit approval
   and the appropriate durable quotas or restricted operator controls.

Only the critical benchmark default and redundant native dependency were changed
in executable project code/configuration. Verification artifacts, this report,
Stage 2 coverage and deployment documentation were added/updated. The deterministic
engine, schemas, detectors, shrinker, compiler semantics, UI components and styling
remain unchanged. Changes are committed locally; no push, merge or deployment.
