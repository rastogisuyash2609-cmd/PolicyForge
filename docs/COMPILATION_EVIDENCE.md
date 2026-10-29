# Durable evidence for separately authorized compilation tests

Implemented offline from c26ba11. **No new live test has been run.** ADV-01's
historical attempt remains UNCONFIRMED in ADVANCED_LIVE_RESULTS.json; this feature
does not reconstruct or change it. Recording a receipt is not semantic approval,
activation, billing confirmation or authorization for another request.

## How the next result is captured

After a new, explicit one-request authorization and balance/reserve review, Codex
will start the normal one-worker backend with the existing temporary live/budget
overrides **and** this nonsecret operator setting:

```powershell
$env:POLICYFORGE_LIVE_TEST_ID = 'ADV-01'
```

This setting enables local evidence recording only; it does not enable AI. It is
blank by default. No root .env edit is required. The existing Analyze workflow,
workspace code, consent and single Compile click remain unchanged. Do not use the
fixed refund smoke script for this test. Nothing in this document authorizes the
next attempt. Keep POLICYFORGE_ENABLE_LIVE_AI=false until separately approved.

When the authorized live endpoint accepts an attempt:

1. Validate configuration, workspace access, UUID, input and the existing gate.
2. Reserve an exclusive **pending** receipt before constructing the SDK/client or
   starting inference. Failure to reserve prevents inference. The existing process
   gate consumes accepted attempts even when local recording cannot start.
3. Execute the existing bounded whole-document compiler: at most one provider
   request, 1536 output tokens, 30-second per-operation timeout, zero SDK/HTTP/wrapper
   retries, zero compiler repairs/fallbacks. No deterministic engine changes.
4. Save the successful locally validated IR or sanitized failure metadata before
   returning the response. Final writes use a separate file, flush/fsync and atomic
   replacement. If saving fails, return evidence_write_failed and retain the pending
   receipt; **do not retry**. A provider may already have billed the request.
5. The successful API response includes `provider_mode` and
   `evidence: {test_id, request_id, status: "saved"}`. The existing frontend need
   not save anything to preserve this receipt. Switching pages or refreshing can
   still clear its transient draft, but not the backend file. Reading evidence
   never activates rules or changes the current analysis session.

Once the one response arrives, disable live AI using the existing shutdown
procedure. Inspect the saved record; do not restart a live worker to replenish a
consumed allowance. Pending/unknown records are potentially billed, not zero.

## Storage and contents

Default directory on this checkout:

```text
C:\Users\Suyash Rastogi\PolicyForge\.local\compile-evidence\
```

Each record is `<request UUID>.json`, independent of the committed test ledger.
The directory is Git-ignored and is not under the frontend/public tree. Receipts
remain across browser refreshes and backend restarts. Existing UUIDs cannot be
overwritten/reused, even after restart. This protects correlation evidence; it
**does not turn the per-process quota into a durable account-wide quota**.

Fields include:

- Test ID, UTC start/completion timestamps, request correlation UUID.
- Server-derived provider mode (`nebius`, `mock`, or `unknown` before transport is
  established), configured model, request-attempt count, real-provider attempt
  count, response-received flag and real_provider_success.
- Validated Policy IR on success; Pydantic/grounding PASS/FAIL/NOT_RUN.
- Provider-reported input/output/total tokens or null when unavailable.
- Finish reason, truncation flag, fixed error code and pending/success/failed status.
- SHA-256 of the exact input, allowing comparison to the intended policy without
  retaining a second raw copy of the policy. Expected fixture rules are never
  substituted for actual output. Semantic correctness still needs human review.

No headers, API/workspace keys, raw provider responses/errors, full prompt, separate
raw policy copy, client IP, user agent, display name or user identity are stored.
Only schema-required rule names, predicates and source references/quotes are kept
as part of the requested IR; those can contain business policy data. Use synthetic
inputs for tests and keep the receipt directory private. This is not an arbitrary
personal-data detector. Operator recording is opt-in to avoid saving unrelated
policy documents automatically.

The writer checks receipts for configured API/workspace secrets, including normal
JSON escaping. Unsafe IR is rejected/withheld, not edited into a different business
rule. CLI reads repeat this check. File creation requests owner-only permissions
where supported; Windows inherits the directory ACL. Do not publish/share the
directory. Optional POLICYFORGE_EVIDENCE_DIR must point to private persistent
storage, outside frontend/public, with appropriate OS permissions and Git exclusions.
Within this checkout the writer permits only the ignored default directory or its
children; tracked/public checkout locations are rejected before inference.
These are local application records, not tamper-proof provider billing receipts.

## Real versus mock

The client identifies actual configured HTTP transport as `nebius`; an injected
test transport is `mock`. Explicit use_mock API responses now carry mode=mock,
provider_mode=mock, provider_requests=0. If operator recording is enabled, mock
recording additionally requires workspace authorization and a UUID and never uses
the live process gate or an external inference request.

SDK MockTransport tests may execute one simulated SDK request: their receipt says
provider_mode=mock, provider_request_count=1, real_provider_requests_attempted=0,
real_provider_success=false. An explicit offline mock route has zero provider
attempts. HTTP 200 alone is never used to establish real-provider success.

real_provider_success requires server mode nebius, exactly one attempt, a returned
provider response, finish_reason=stop, nonempty validated rules, Pydantic/grounding
PASS and no error. Provider errors and validation/truncation failures retain their
mode/count/usage where available, but never store raw invalid output. Unknown
counts in interrupted pending receipts remain null. Missing credentials, disabled
mode, unauthorized requests and gate rejections happen before a recorded live
attempt and do not produce a receipt. Blank recording ID preserves normal API
behavior and does not create files.

## Inspect after a refresh, without inference

Ask Codex: **“Show the saved compilation evidence for ADV-01; keep live AI off.”**
Or use the existing Python 3.11 runtime:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.inspect_compile_evidence list --test-id ADV-01
```

Copy the UUID from that listing, then substitute it for `<request UUID>`:

```powershell
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.inspect_compile_evidence show '<request UUID>'
```

These commands read local files only. They create no SDK client, require no live
server and work with live AI disabled. The listing shows mode/status/count, not
an assumed success. `show` returns the saved IR/validation/usage/error metadata.
The owner can also open the JSON directly through Codex. No public retrieval API
was added. The committed historical ledger can then be updated from these actual
records without inventing unavailable information or overwriting the earlier
UNCONFIRMED entry.

## Offline verification

tests/test_compile_evidence.py covers success/recovery with a fresh store and
CLI after disabling live AI; explicit and SDK mock labeling; missing usage;
invalid JSON/schema/grounding; truncation; timeout/auth/credit/rate failures;
secret echoes/escaping; disk reservation/finalization failure; atomic replacement;
pending unknown counts; UUID reuse after a simulated restart; corrupt files and
path traversal. Fixtures are synthetic and stored only in pytest temporary paths.
Existing test guards block real HTTPX transport; the operator recording ID is
removed from ordinary offline tests to prevent writes into a real receipt store.

Backend suite: **306 passed, 0 failed; 1 live test deselected**. No frontend files
changed; no TypeScript/build or frontend rebuild is necessary for this backend
receipt feature. The normal running backend stays live-disabled and is not
restarted in this phase. The next separately approved startup loads the new code.
