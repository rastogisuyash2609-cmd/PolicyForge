# Phase 9A: dependency security remediation

Verified locally on 2026-10-29, starting from commit 1a5a08a. **Zero live Nebius
requests, paid inference or benchmark executions.** No push, merge, deployment,
tunnel or public binding. The existing application/compiler/Policy IR/engine/UI
source is unchanged; only dependency configuration and documentation changed.

## Audit findings and fixes

The original six are npm package-level findings, not six independent CVEs. Three
development entries describe the same inherited glob CLI advisory. The refreshed
before scan reproduced all six, including the critical Next.js finding. The raw
advisory titles, ranges, IDs and dependency paths are preserved in
[SECURITY_AUDIT_PHASE9A_BEFORE.json](SECURITY_AUDIT_PHASE9A_BEFORE.json).

| Package | Original installed version | Severity | Scope and advisory | Patched version / applied fix | Breaking change assessment |
| --- | --- | --- | --- | --- | --- |
| next | 14.2.15 | Critical | Production; multiple advisories below, including middleware bypass and Windows/image RCE | 15.5.28 | Required major upgrade: no 14.x patch clears all reported ranges. Async request APIs and cache defaults change in 15; this app does not use the affected server request APIs or server fetch caching. Build/browser checks pass without component changes. |
| postcss | 8.4.31 inside next | High | Production dependency/build processing; GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | >=8.5.23 clears the reported ranges; override Next's copy to existing root version 8.5.30 | Same major; compatible patch/minor. Root PostCSS 8.5.30 was already clean; upgrading it alone would not fix the nested copy. |
| glob | 10.3.10 | High | Development, Next ESLint plugin; GHSA-5j98-mcp5-4vw2, command injection in CLI -c/--cmd | >=10.5.0 within major 10, or upgrade parent; applied parent 15.5.28 removes this dependency path | No application runtime change. The patched parent uses fast-glob 3.3.1. The separate glob 7.2.3 dev dependency is outside this advisory range. |
| @next/eslint-plugin-next | 14.2.15 | High | Development, inherits glob GHSA-5j98-mcp5-4vw2 | 15.5.28 via eslint-config-next | Tooling major aligned with Next; existing lint configuration passes. No separate advisory attributed to this package. |
| eslint-config-next | 14.2.15 | High | Development direct dependency, inherits plugin/glob GHSA-5j98-mcp5-4vw2 | 15.5.28 | Tooling major aligned with Next; ESLint 8 retained within declared peer range. |
| postcss-selector-parser | 6.1.4 | Moderate | Development, Tailwind/postcss-nested; GHSA-rj75-hqrm-r3gf, quadratic selector parsing CPU exhaustion | 6.1.5 | Compatible patch, targeted lockfile update; no override needed. |

The Next.js critical SVG advisory is also CVE-2026-96889. Advisory-specific
reachability depends on enabled features and hosting platform; no feature-based
exemption was used to waive a finding. Dependencies classified production can be
used chiefly during build; the build pipeline still needs their fixes.

The registry's default audit recommendation was Next.js 16.4.3. Instead, the
[official SVG advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
identifies 15.5.28 as patched, and both fresh audits confirm the chosen dependency
tree clears all reported advisories. Next 14's latest available version was
14.2.35 and still fell inside later affected ranges. No force/legacy-peer-deps
installation or automatic audit fix was used.

## Changes and compatibility

- frontend/package.json: pin Next.js, its existing direct Windows SWC package and
  eslint-config-next to 15.5.28. Scope the PostCSS 8.5.30 override to Next.js.
- frontend/package-lock.json: regenerate for those targets; update selector parser
  6.1.4 -> 6.1.5 within existing constraints. Next now resolves sharp 0.35.5,
  satisfying the image RCE advisory's upstream mitigation. Next's related env/SWC,
  helper/styled-jsx packages and ESLint hook plugin change with their parent.
- frontend/tsconfig.json: retain Next 15's generated ES2017 target requirement.
- frontend/README.md and docs/DEPLOYMENT.md: update dependency status, repeat-audit
  instructions, target-platform caveat and remaining release prerequisites.
- This report and five SECURITY_AUDIT_PHASE9A*.json files: before/after evidence,
  production scope, actual Python environment and fresh manifest resolution.

React/react-dom remain 18.3.1 and ESLint remains 8.57.1; installed Next 15.5.28
metadata accepts React ^18.2.0 and ESLint config accepts ESLint ^8. No unused
framework APIs were migrated speculatively. The
[Next 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
was reviewed for request API and caching changes. App Router bundles its own React
implementation; the production build and actual browser flows were verified.
`next lint` still works in 15 but emits its upstream deprecation notice for 16.
No lint errors or warnings were reported by the application rules.

Python requirements and installed application dependencies were not changed.
pip-audit 2.10.1 ran from a separate temporary Python 3.13 tooling environment,
outside the Python 3.11 application environment. Two complete scans succeeded:

- Actual Python 3.11 site-packages: **32 packages, zero known vulnerabilities**,
  including production dependencies/transitives and development pytest/Hypothesis.
- Fresh requirements-dev.txt resolution: **31 packages, zero known vulnerabilities**.
  This tooling resolution uses Python 3.13 and is not a claim that those versions
  were installed/tested in the application. For example, it resolves Starlette
  1.10.0, while the tested Python 3.11 environment has 1.9.0. Both are clean in
  these scans. The actual environment scan is the runtime security evidence.

No dependencies were skipped or advisories ignored. Package compatibility and
application behavior were also checked by the full Python regression suite.

## Final verification

| Check | Result |
| --- | --- |
| Full npm audit | **0 vulnerabilities**, exit 0; SECURITY_AUDIT_PHASE9A_AFTER.json |
| Production npm audit --omit=dev | **0 vulnerabilities**, exit 0; SECURITY_AUDIT_PHASE9A_PRODUCTION.json |
| Actual Python environment pip-audit | **0 known vulnerabilities**, exit 0; SECURITY_AUDIT_PHASE9A_PYTHON.json |
| Python manifest resolution pip-audit | **0 known vulnerabilities**, exit 0; SECURITY_AUDIT_PHASE9A_PYTHON_MANIFEST.json |
| Full offline backend tests | **230 passed, 1 live test deselected** by the existing default marker |
| Frontend offline tests | **63 passed** |
| Real loopback API integration | **10 passed**, deterministic routes only |
| TypeScript | Passed, explicit tsc --noEmit --incremental false |
| ESLint | Passed, no application rule warnings/errors; upstream next lint deprecation notice only |
| Production build | Passed, all 12 static pages generated using Next 15.5.28 |
| Browser workflow | Mocked compile/review/activate, Stress Testing, Reports, What-if, invalid and stale response preservation passed |
| Secret exposure checks | 123 build/public files, 278 total scanned files; zero configured-key matches, zero frontend provider-key environment reads |
| Root .env | Git-ignored and untracked; never displayed or modified |
| Smoke runner default preflight | prepared_live_disabled, configured Nano model, 1536 cap, 30 seconds, zero retries/repairs, **0 requests** |
| Local services | Patched production Next at 127.0.0.1:3000; existing FastAPI at 127.0.0.1:8000, /api/health 200; live AI OFF |

The production browser also loaded Analyze with fixtures and disabled Compile
until consent; its warning/error log was empty. An unauthenticated local compile
probe returned 503/live_disabled at the first authorization gate, before any
provider client can be initialized, confirming the running backend is live-OFF.

The browser harness from tests/browser_mock_api.py overrides inherited credentials
with offline fixture configuration and blocks real sync/async HTTPX transports.
Page load and typing leave its counter at 0. One explicit mocked compilation
validates/grounds the 30-day rule; activation creates AI-origin revision 2.
Stress executes 30 deterministic journeys (18 with findings, 1 unique signature),
and Reports preserves revision/fingerprint, rule/source evidence and fixture usage.
What-if compares the captured AI snapshot with v1 over 5 shared journeys. Invalid
mock output returns a safe validation error and retains prior draft/active rules;
a delayed reply after editing is discarded. Final counter: **3 mocked attempts,
0 real provider calls**. Browser error/warning log was empty. Report screenshot:
phase9a-mocked-report.png in the task's local visualization folder (usage is fixture
data). The temporary test tab and test servers are stopped after verification.

## Release status and remaining prerequisites

**All six identified dependency findings are fixed, as confirmed by completed
audits.** There is no remaining finding in the scanned npm/Python dependencies.
This clears that specific public-deployment blocker; it is not a general security
certification or authorization to deploy. Advisory databases can change.

Remaining deployment work from Phase 8 still applies: TLS/reverse proxy with abuse
controls for every route; operator authentication for the paid path; provider-side
spending controls; durable shared quotas/idempotency and per-user authorization
before multi-instance or anonymous public live use. Current gates are process-local
and reset on restart. Keep live AI OFF for any public deterministic demo until
authorized operator access is in place. The new UI/API path has only mocked provider
verification; no additional real-provider test is authorized by this phase.

Windows is the verified hosting platform. The pre-existing direct Windows SWC
dependency must be removed in favor of Next's optional platform selection before
a Linux install, followed by target-platform CI. No cross-platform deployment was
attempted. Python manifests pin direct dependencies but not their full transitive
tree; audit the actual release environment. The previously recorded engine payload
warning and finding identity/coverage limitations remain unchanged; schema/grounding
validation is not proof of natural-language semantic completeness.

Next steps: review this local commit, prepare the intended hosting platform and
authentication/ingress/quota controls, then repeat clean-install validation and
security audits for that release. Any paid test, push or deployment needs separate
explicit authorization. No next phase started automatically.

## Audit reproduction

From frontend/: `npm ci`, `npm audit --json`, and
`npm audit --omit=dev --json`. Retain nonzero audit exit codes as failures.

Use pip-audit in an isolated tooling environment to audit the actual release
environment, for example:

```powershell
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-security-audit\Scripts\python.exe' -m pip_audit --path 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Lib\site-packages' --format json
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-security-audit\Scripts\python.exe' -m pip_audit -r backend/requirements-dev.txt --format json
```

Audits contact package advisory/registry services only. Offline application tests
block provider network transports, and the smoke preflight has no execution flag.

## Complete original advisory inventory

The table below expands every direct advisory returned by the original six
package-level findings. Inherited plugin/config findings are described above.

| Package | Severity | Advisory | Affected range in before scan | Applied resolution |
| --- | --- | --- | --- | --- |
| glob | high | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) - glob CLI: Command injection via -c/--cmd executes matches with shell:true | >=10.2.0 <10.5.0 | Vulnerable path removed with Next ESLint 15.5.28 |
| next | moderate | [GHSA-7m27-7ghc-44w9](https://github.com/advisories/GHSA-7m27-7ghc-44w9) - Next.js Allows a Denial of Service (DoS) with Server Actions | >=14.0.0 <14.2.21 | Next 15.5.28 |
| next | low | [GHSA-3h52-269p-cp9r](https://github.com/advisories/GHSA-3h52-269p-cp9r) - Information exposure in Next.js dev server due to lack of origin verification | >=13.0 <14.2.30 | Next 15.5.28 |
| next | moderate | [GHSA-g5qg-72qw-gw5v](https://github.com/advisories/GHSA-g5qg-72qw-gw5v) - Next.js Affected by Cache Key Confusion for Image Optimization API Routes | >=0.9.9 <14.2.31 | Next 15.5.28 |
| next | moderate | [GHSA-4342-x723-ch2f](https://github.com/advisories/GHSA-4342-x723-ch2f) - Next.js Improper Middleware Redirect Handling Leads to SSRF | >=0.9.9 <14.2.32 | Next 15.5.28 |
| next | moderate | [GHSA-xv57-4mr9-wg8v](https://github.com/advisories/GHSA-xv57-4mr9-wg8v) - Next.js Content Injection Vulnerability for Image Optimization | >=0.9.9 <14.2.31 | Next 15.5.28 |
| next | low | [GHSA-qpjv-v59x-3qc4](https://github.com/advisories/GHSA-qpjv-v59x-3qc4) - Next.js Race Condition to Cache Poisoning | >=0.9.9 <14.2.24 | Next 15.5.28 |
| next | high | [GHSA-mwv6-3258-q52c](https://github.com/advisories/GHSA-mwv6-3258-q52c) - Next Vulnerable to Denial of Service with Server Components | >=13.3.0 <14.2.34 | Next 15.5.28 |
| next | high | [GHSA-5j59-xgg2-r9c4](https://github.com/advisories/GHSA-5j59-xgg2-r9c4) - Next has a Denial of Service with Server Components - Incomplete Fix Follow-Up | >=13.3.1-canary.0 <14.2.35 | Next 15.5.28 |
| next | moderate | [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) - Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration | >=10.0.0 <15.5.10 | Next 15.5.28 |
| next | high | [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) - Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components | >=13.0.0 <15.0.8 | Next 15.5.28 |
| next | critical | [GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw) - Authorization Bypass in Next.js Middleware | >=14.0.0 <14.2.25 | Next 15.5.28 |
| next | moderate | [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) - Next.js: HTTP request smuggling in rewrites | >=9.5.0 <15.5.13 | Next 15.5.28 |
| next | moderate | [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) - Next.js: Unbounded next/image disk cache growth can exhaust storage | >=10.0.0 <15.5.14 | Next 15.5.28 |
| next | high | [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) - Next.js has a Denial of Service with Server Components | >=13.0.0 <15.5.15 | Next 15.5.28 |
| next | high | [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) - Next.js Vulnerable to Denial of Service with Server Components | >=13.0.0 <15.5.16 | Next 15.5.28 |
| next | low | [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) - Next.js's Middleware / Proxy redirects can be cache-poisoned | >=12.2.0 <15.5.16 | Next 15.5.28 |
| next | moderate | [GHSA-ffhc-5mcf-pf4q](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) - Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces | >=13.4.0 <15.5.16 | Next 15.5.28 |
| next | low | [GHSA-vfv6-92ff-j949](https://github.com/advisories/GHSA-vfv6-92ff-j949) - Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting | >=13.4.6 <15.5.16 | Next 15.5.28 |
| next | moderate | [GHSA-gx5p-jg67-6x7h](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) - Next.js has cross-site scripting in beforeInteractive scripts with untrusted input | >=13.0.0 <15.5.16 | Next 15.5.28 |
| next | moderate | [GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) - Next.js has a Denial of Service in the Image Optimization API | >=10.0.0 <15.5.16 | Next 15.5.28 |
| next | high | [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) - Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades | >=13.4.13 <15.5.16 | Next 15.5.28 |
| next | moderate | [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7) - Next.js vulnerable to cache poisoning in React Server Component responses | >=14.2.0 <15.5.16 | Next 15.5.28 |
| next | high | [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) - Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n | >=12.2.0 <15.5.16 | Next 15.5.28 |
| next | high | [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) - Next.js: Denial of Service in App Router using Server Actions | >=13.0.0 <15.5.21 | Next 15.5.28 |
| next | high | [GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) - Next.js: Server-Side Request Forgery in Server Actions on custom servers | >=14.1.1 <15.5.21 | Next 15.5.28 |
| next | moderate | [GHSA-68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742) - Next.js: Cache confusion of response bodies for requests with bodies | >=13.0.0 <15.5.21 | Next 15.5.28 |
| next | moderate | [GHSA-4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q) - Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences | >=13.0.0 <15.5.21 | Next 15.5.28 |
| next | moderate | [GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3) - Next.js: Unbounded Server Action payload in Edge runtime | >=13.0.0 <15.5.21 | Next 15.5.28 |
| next | high | [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) - Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname | >=12.0.0 <15.5.21 | Next 15.5.28 |
| next | moderate | [GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp) - Next.js: Unauthenticated disclosure of internal Server Function endpoints | >=13.0.0 <15.5.21 | Next 15.5.28 |
| next | critical | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) - Next.js: Unauthenticated Remote Code Execution on windows-hosted servers | >=13.4.0 <15.5.24 | Next 15.5.28 |
| next | critical | [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) - Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used | >=10.0.0 <15.5.24 | Next 15.5.28 |
| next | critical | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) - Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used | >=10.0.0 <=15.5.27 | Next 15.5.28 |
| next | high | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) - Next.js: Denial of Service in App Router using Server Actions | >=13.0.0 <=15.5.27 | Next 15.5.28 |
| postcss | moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) - PostCSS has XSS via Unescaped </style> in its CSS Stringify Output | <8.5.10 | PostCSS 8.5.30 |
| postcss | high | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) - PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments | <=8.5.11 | PostCSS 8.5.30 |
| postcss | moderate | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) - PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset | <=8.5.22 | PostCSS 8.5.30 |
| postcss | high | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) - PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | <=8.5.17 | PostCSS 8.5.30 |
| postcss-selector-parser | moderate | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) - PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion | <6.1.5 | 6.1.5 |
