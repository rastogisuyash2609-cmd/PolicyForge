# ADV-01 status investigation — correction to earlier reports

Investigated on 2026-10-29. Live AI remains disabled. No backend restart, budget
reset, provider/model/billing API call, Compile click, active-rule change or new
inference occurred during this investigation. Local health GETs are not inference.

## What the evidence establishes

The original live-enabled backend was process 14536, tool session 33065, with one
worker, no reload and a configured one-attempt process budget. The execution
transcript retained these sanitized observations:

| Observation | UTC record time | Asia/Kolkata record time |
| --- | --- | --- |
| Backend startup output returned | 2026-10-29 04:46:59.128 | 2026-10-29 10:16:59.128 |
| Setup poll: one unauthenticated compile 401, zero compile 200s | 2026-10-29 04:48:08.202 | 2026-10-29 10:18:08.202 |
| Pause inspection: one compile 200, no warnings/errors, untruncated summary | 2026-10-29 04:56:43.467 | 2026-10-29 10:26:43.467 |
| Live-disabled replacement startup output returned | 2026-10-29 04:57:06.773 | 2026-10-29 10:27:06.773 |

These are **tool-output collection timestamps**, not the request's exact server
timestamp. The successful route entry appeared between successive output polls,
approximately 10:18–10:27 IST. The exact time cannot be recovered from the retained
summary. The original access line, client port, request mode/body/headers, UUID,
response body and provider usage were not preserved. The later pause record's
04:57:46 UTC timestamp is the record-writing time, not an inference timestamp.

## Why a real Nebius call cannot be confirmed

api.py routes explicit `use_mock=true` requests to _compile_mock_policy, which can
return HTTP 200 **without external inference**. Requests with live=true/use_mock=false
go through the bounded live client. A bare `/api/compile` HTTP 200 does not identify
which branch ran. The offline branch does not consume the live request guard.

Consequently, the earlier inference that this status proved exactly one real
Nebius call, a consumed live allowance, and successful live Pydantic/grounding
checks was too strong. Those assertions are withdrawn in ADVANCED_LIVE_RESULTS.json.
HTTP 200 remains an observed route status; **provider count is unknown, not zero**.
No successful ADV-01 extraction or validation is established by this evidence.
The historical Phase 9B owner-confirmed refund test is separate and unchanged.

The root task's execution record shows its setup probe had no authorization and
returned 401. That probe cannot reach SDK construction or consume the guard.
No tool calls are recorded in this task between the final setup poll and the
subsequent pause request. No recorded Compile click, smoke execution, authenticated
automated compilation or benchmark explains the 200. This does not establish who
sent it: the caller may have been another browser/process or an explicit offline
request, but those remain hypotheses. Browser versus automation attribution is
**unavailable**, not inferred from a loopback URL or the backend's enabled setting.

The current local operational log database has no matching raw session/access
record for that time window. The retained task transcript preserves the sanitized
summary only. No authenticated provider/account endpoint was queried to resolve it.

## Recovery and current browser evidence

Read-only inspection of the sole available in-app browser tab confirmed:

- Analyze Policy at http://127.0.0.1:3000/workspace/analyze.
- Demo Policy selected; empty name/text; no generated draft or usage line.
- NovaCart v1 active, revision 1, 12 rules, fingerprint 22ac14be.
- Compile and Activate disabled. No inputs, toggles, navigation or buttons changed.
- Retained browser console entries filtered for /api/compile: none. An empty
  console is not proof that no network request occurred.

WorkspaceProvider and usePolicyCompilation hold drafts, active revisions and
compilation provenance in React memory. They do not persist them to localStorage,
sessionStorage or a backend compilation history. The backend returns IR/usage to
the caller but does not save a durable compilation response. Available repository
artifacts contain synthetic expected rules and historical reports, not a recovered
ADV-01 provider response. No previous generated ADV-01 rule was recovered.

The empty current tab cannot prove no call occurred in another/earlier tab, after
which a draft might have been lost, discarded or cleared. Equally, it cannot be
used to claim the user performed the manual steps. The owner explicitly reports
that those steps were not completed; that report is retained without contradiction.

## Safe continuation

1. Leave live AI OFF and the original active NovaCart rules unchanged. Backend
   health and Analyze GETs return 200; the last verified runtime compile gate was
   503/live_disabled, and no live enablement has occurred since.
2. Treat the uncertain call as potentially billed. Do not reset or enable a live
   allowance, repeat ADV-01 or reconstruct its output through inference.
3. The owner can inspect existing Nebius dashboard usage/request history, if
   available, around the interval above, without invoking a model. Useful evidence
   would be request time/ID, model and usage. Aggregate/rounded balance alone cannot
   attribute a call to this policy. Do not share API keys or authorization headers.
   No claim is made that the dashboard exposes per-request records or prompts.
4. If the record remains unrecoverable, label this prior attempt UNCONFIRMED.
   The next route is a **separately and explicitly authorized new one-request
   attempt**, not a resumed unused allowance. Verify usable credit and preserve the
   $20.50 shared reserve first, conservatively allowing for the unknown prior call.
   Capture the safe response metadata, actual IR and usage before leaving the tab.
   Any receipt/telemetry hardening must be separately scoped; it was not built here.

No automatic new attempt is authorized by this investigation. Do not claim an
ADV-01 PASS or FAIL until actual policy input/output and semantic evidence exist.
