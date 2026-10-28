# Phase 8: real AI integration and offline policy testing preparation

Completed locally on 2026-10-29. **Zero additional live Nebius requests or paid
inference.** No benchmark CLI, batch policy compilation, push, merge, public
binding, cloud release or deployment occurred. The three previously approved live
smoke tests remain the entire known live-test history; no account balance was queried.

## Integration and supported workflow

The existing Analyze UI now calls POST /api/compile only after the operator enters
a policy name/text, enters the separate workspace access code, checks per-request
paid consent, and clicks Compile with NVIDIA. The access code is an application
credential, not NEBIUS_API_KEY. Provider credentials remain backend-only.

The backend requires its feature flag (default OFF), operator authorization and
an idempotency UUID. It uses the configured NVIDIA Nemotron model and the existing
schema-derived compiler prompt. One whole-document extraction replaces the former
clause-by-clause live calls. SDK output first passes a Pydantic rules envelope and
raw recursive condition validation; the existing compiler then performs local Rule
validation, source grounding and lint. Mixed condition keys are rejected before
the existing group pre-parser can discard them. Duplicate IDs and incorrect source
document names are rejected. No schema or deterministic engine was weakened.

Valid rules become a draft, with model/request/usage provenance; they do not activate
automatically. The user inspects source quotations and conditions, may switch to
manual editing, then explicitly activates. AI provenance is retained only for the
unchanged compiled draft. Edited prose blocks AI activation until recompilation or
manual review; editing rules marks the draft manual. Activation creates a new
immutable active revision and resets earlier analysis through the existing session.

Issues, simulation, Stress Testing, What-if snapshots and Reports reuse those exact
active rules. Findings remain entirely deterministic Python output. Reports carry
the active origin/revision and extraction provenance separately from test results.
Demo/manual functionality remains available with no AI access code or provider key.

## Reliability and cost safeguards

- No calls on page load, typing, mode changes, consent checking or navigation.
  No frontend retry loop; an in-flight ref blocks duplicate clicks. Input/route
  identity and AbortSignal prevent stale replies from replacing a changed draft.
- No implicit fixture fallback when credentials are absent. Explicit use_mock mode
  remains available for legacy offline tests only; live+mock together is rejected.
- One provider POST per authorized API invocation; 1536 output tokens; 30-second
  provider timeout per operation; zero SDK, wrapper and transport retries, zero
  compiler repairs and zero fallback calls. Frontend timeout: 40 seconds.
- One active compilation per process, two attempts per minute, a hard process
  budget of 3 by default (clamped 1..10), persistent-in-process request-ID rejection,
  and five-minute exact-content duplicate rejection. Failures consume the accepted
  attempt. Limits are process-local, not an account-wide $29.50 credit guarantee.
- Input limit: 4000 characters; one document; 8 rules; 16 KiB compile request body.
  Other POST bodies are limited to 1 MB. Arbitrary output-cap/repair options and
  document batches are rejected. Redirects and environment proxies are disabled.
- Missing/invalid configuration, access denial, empty input, invalid JSON/IR,
  grounding failure, incomplete/truncated output, rate limits, insufficient credits,
  provider failures/timeouts and duplicate requests produce safe error codes.
  Returned usage is retained when supplied; unknown usage is null, not zero.
- Previous draft/active rules survive failure. No raw provider bodies, unsafe SDK
  exceptions, input echoes or keys are returned. Unexpected credential echoes in
  generated output are rejected, including JSON-escaped forms. SDK logging remains
  suppressed during bounded provider work.
- Exact-origin CORS replaces wildcard-with-credentials. The server flag and separate
  minimum-24-character workspace token gate paid work; reusing the provider key as
  an access code is rejected. The frontend holds the access code only in memory.

The shared endpoint/configuration/transport guards were extracted unchanged from
nebius_smoke.py into provider_safety.py. The smoke module re-exports its original
symbols; all smoke tests and local preflight pass. This prevents importing the CLI
runner through the production API and keeps the fixed smoke operation independent.
The general compiler gains only an opt-in whole_document mode; default clause and
offline repair behavior outside this guarded API path is preserved.

The response's clause counters describe one whole-document extraction unit, not
proof that every natural-language obligation was covered. Schema and grounding
cannot establish semantic completeness; explicit human review is required. Longer
policies can exhaust 1536 tokens and fail safely. No reasoning override or speculative
json_schema provider setting was added. No balance or pricing API call is needed.

## Prepared Stage 2 cases

Six synthetic documents and expected IR/behavior fixtures cover simple refunds,
damaged-item replacements, replacement cancellation, combined refund/replacement
rules, strict versus inclusive boundaries, and ambiguous language. Every fixture
declares fields/operators, exact grounding expectations, validation criteria and
whether live inference is necessary. Automated tests require none. The ambiguous
example expects rejection/clarification instead of an invented numeric duration.
See [STAGE2_POLICY_CASES.md](STAGE2_POLICY_CASES.md). No batch live runner was added.

## Verification results

| Check | Final result |
| --- | --- |
| Full offline backend pytest | **230 passed, 1 live test deselected** |
| Frontend unit tests | **63 passed** |
| Frontend ↔ local FastAPI deterministic integration | **10 passed** |
| Explicit TypeScript check | Passed |
| ESLint | Passed; no warnings/errors |
| Production build | Passed; all 12 static pages generated |
| Mocked browser workflows | Compile/review/activate/stress/report/What-if plus invalid/stale response preservation passed; **3 mock requests, 0 real provider calls** |
| Smoke CLI default preflight | prepared_live_disabled; configured Nano model, cap 1536, timeout 30, all retries/repairs zero, **0 requests** |
| Build/public asset secret scan | **113 build and public files**, including static assets and prerender/server output, no configured provider key found; no frontend process.env.NEBIUS_API_KEY reads |
| Root .env tracking | Git-ignored and untracked; credentials not modified |
| Python dependency compatibility | No installed metadata dependency conflicts. This temporary environment lacks pip, so pip check was unavailable; the offline importlib.metadata/packaging check was used instead |
| npm dependency audit | **FAILED: 6 findings — 1 critical, 4 high, 1 moderate**. Full result preserved in SECURITY_AUDIT_PHASE8.json; public release blocked |

Initial Stage 2 fixture failures were corrected: Rule.model_validate mutated shared
fixture dictionaries, so the validation test now loads through JSON without altering
later cases. No failing behavioral test was deselected. The live-provider marker
is intentionally excluded by the normal pytest configuration. The first sandboxed
npm audit could not resolve the registry; its completed network audit is recorded
above, not presented as a clean scan. No automatic major framework upgrade was made.
The existing engine emitted a non-blocking Pydantic serializer warning for a VIP
payload stored as a string; corresponding integration assertions passed. Its
permissive payload/assignment behavior remains unchanged and is recorded here.

See [BROWSER_TESTS_PHASE8.md](BROWSER_TESTS_PHASE8.md) for the isolated test harness,
executed steps, counter evidence and reproduction instructions. Screenshot usage
figures are fixtures, not real billing. The actual new local production services
were restarted on 127.0.0.1:3000 and 127.0.0.1:8000 with live AI explicitly OFF.
GET /api/health returned 200.

## Files changed

Backend: api.py, compiler.py, nebius_smoke.py; new live_compile.py, provider_safety.py,
request_limits.py, requirements.txt and requirements-dev.txt. Engine/models/detectors/
scenario generation/shrinking/diff algorithms and benchmark artifacts are unchanged.

Frontend: existing AnalyzeScreen, PoliciesScreen, StressTest, RuleInspector,
ReportView, WorkspaceProvider and WorkspaceShell; api.ts, api-types.ts,
api-contracts.ts, http-client.ts, policy-domain.ts, comparison.ts, reports.ts;
new use-policy-compilation.ts and compilation.test.ts; package.json test command,
next.config.mjs test build isolation, tsconfig.json generated test types, .gitignore,
small landing-page capability text and current README/handoff/contract notices.
No application dependency versions or lockfile were changed.

Tests/fixtures: new test_live_compile.py, test_stage2_policies.py,
tests/fixtures/stage2/policy_cases.json, and browser_mock_api.py. Configuration/docs:
.env.example, root .gitignore, BACKEND_CONFIGURATION.md, DEPLOYMENT.md,
STAGE2_POLICY_CASES.md, BROWSER_TESTS_PHASE8.md, SECURITY_AUDIT_PHASE8.json, this report.
The pre-existing untracked .agents directory is excluded from the commit.

## Deployment readiness and next steps

No existing container/cloud deployment configuration was present; the existing
Next.js config, npm scripts and FastAPI launch instructions were reviewed. New
deployment instructions cover Python/Next.js startup, backend-only secrets, CORS,
TLS, ingress limits, operator access, live opt-in and public-release prerequisites.

Public deployment remains **blocked** by the dependency audit. Resolve the Next.js
and transitive package findings with a supported upgrade and rerun all checks before
internet exposure. Single-worker process-local quota/idempotency is sufficient only
for a bounded operator demo; multi-instance/public service needs durable shared
quotas, per-user authentication and gateway abuse controls. See [DEPLOYMENT.md](DEPLOYMENT.md).

The new UI/API provider path is wired and mock-verified, but has not been tested
against live Nebius in this phase. After fresh authorization, the owner must manually
configure a separate workspace access code, explicitly enable live mode for the
backend process, and allow exactly one representative document through the UI.
Review model usage and draft semantics before activation; stop after that result.
Do not use the fixed smoke CLI as a document batch runner. Do not launch 300 paid
compilations. No further phase starts automatically.

One local Phase 8 commit records this work; its hash is supplied in the completion
message. Nothing was pushed, merged or deployed.
