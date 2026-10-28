# Phase 7C: Nemotron truncation diagnosis and offline changes

Date: 2026-10-29. No Nebius API request, model discovery, live smoke test, full
benchmark or frontend AI action was performed during this phase.

## Files changed

- `backend/policyforge/nebius_smoke.py`: compact fixed-input prompt, 1536 cap,
  numeric diagnostics; existing one-request architecture retained.
- `tests/test_nebius_smoke.py`: regression tests for the changes and fixtures.
- `tests/conftest.py`: HTTPX network prohibition for non-live tests.
- `tests/fixtures/nebius_smoke/valid_policy_ir.json`: complete offline example.
- `tests/fixtures/nebius_smoke/truncated_policy_ir.txt`: partial offline example.
- `tests/fixtures/nebius_smoke/first_live_metadata.json`: historical metadata only.
- `docs/NEBIUS_SMOKE_TEST.md`: updated operating instructions and results.
- `docs/NEBIUS_TRUNCATION_FIX.md`: this diagnosis and cost report.

## Evidence and root cause

The first approved request used `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, consumed
637 input / 512 output tokens, and returned `finish_reason=length`. The runner
correctly rejected it before JSON/Pydantic validation. The hard 512 completion-token
budget was exhausted. Authentication and model access had succeeded.

The runner retained aggregate usage and finish reason, not raw content, reasoning
text, or a reasoning-token breakdown. Consequently it is impossible to establish
how many of those 512 tokens were reasoning, how many were visible JSON, or whether
the model included unnecessary explanation. The old prompt already requested no
prose; verbose schema instructions are not evidence of verbose output.

The original generic compiler prompt listed all event types and state fields,
including unrelated replacement/chargeback concepts. Its base system instruction
was 1755 characters, with additional smoke-specific instructions appended. The new
dedicated instruction is 741 characters; both messages total 837 characters. It
describes the seven required Rule fields, source fields, condition-tree structure,
and only vocabulary relevant to this fixed refund extraction. It supplies no
threshold, answer JSON, added eligibility, exceptions or denial rule. The policy
is still provided verbatim as input.

A hand-authored, locally validated compact Rule envelope is 383 ASCII bytes.
This demonstrates that mandatory Policy IR fields do not require a large JSON
document. Bytes are not exact Nemotron token counts; the exact tokenizer is not
installed, and the first raw response is unavailable. There is no evidence that
the required visible JSON alone necessarily exceeds 512 tokens. The fixtures are
explicit offline examples, not fabricated historical model output.

## Reasoning compatibility and output budget

[NVIDIA's Nano model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16)
documents default thinking and an `enable_thinking` chat-template switch for its
Transformers/vLLM examples. This establishes model capability, not acceptance by
Nebius's gateway for the configured model.

[Nebius's chat API reference](https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion)
lists completion limits and a generic `reasoning_effort` field, but does not
establish its mapping to this Nano model or document `chat_template_kwargs` for it.
[Nebius's Nano cookbook](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/nemotron3-nano-30b.md)
also provides no model-specific thinking-control example. SDK ability to serialize
an extra parameter would not prove provider support. No speculative thinking
parameter, NVIDIA-hosted-only setting, parameter-probing request, or automatic
fallback was added. Reasoning configuration remains **provider default, no verified
override**. Reasoning cannot be claimed disabled.

The selected cap is **1536 output tokens**, using the already accepted `max_tokens`
parameter. It provides three times the previous budget for the small extraction;
2048 is not justified by current evidence. Generation remains bounded even if
reasoning is enabled. A 1536-token success is not guaranteed offline: `length`,
refusal, empty content and other incomplete finish reasons still stop immediately,
even when the visible content happens to be valid JSON. Partial JSON is never
recovered or guessed.

Numeric `reasoning_tokens` is now retained when explicitly returned; missing is
`null`, not an invented zero. Visible-output character count is recorded before
validation. No reasoning text, raw provider response, key or unsafe exception is
logged/returned.

## Preserved controls and offline verification

- One atomic provider-transport attempt per explicit execution, consumed before
  sending; a separate client guard rejects a second compiler invocation.
- SDK, wrapper, transport retries and compiler repairs: all zero. No fallback,
  JSON correction, scenario generation, discovery or background requests.
- HTTPX/SDK timeout: 30 seconds per network operation; redirects/proxies disabled.
- Default CLI is local preflight only; no FastAPI/frontend hook was added.
- The shared Pydantic Rule schema, compiler, client, deterministic engine, routes
  and frontend are unchanged. Existing local grounding, validation and lint run.
- Every non-live backend test blocks real HTTPX sync/async transports. Normal
  pytest excludes the live-provider test. Mocks and FastAPI TestClient remain usable.

Results: **43 smoke-runner tests passed; full backend 164 passed, 1 live test
deselected; frontend 58 passed**. Coverage includes complete and truncated saved
JSON fixtures, invalid schema, grounding failures, complete JSON with `length`,
nullable reasoning telemetry, HTTP errors/timeouts/redirects, redaction, concurrent
attempts, no validation-triggered second request, and the default-off CLI. The
historical metadata fixture contains only user-reported usage/finish reason; partial
content used with it is explicitly synthetic.

The full backend run succeeded outside the restrictive execution sandbox after
the sandboxed run stalled without output and was stopped. Network-blocking fixtures
and default live-test exclusion remained enabled in the successful run.

Local preflight confirmed the configured Nano model, cap 1536, timeout 30, zero
retries/repairs and **0 provider requests**. `.env` is Git-ignored. Real credentials
were never displayed. The frontend unit suite passed without a browser AI action.

## Cost estimate for the next explicitly approved request

[Nebius's published Nano pricing](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference)
lists **$0.06 / million input tokens** and **$0.24 / million output tokens**.
These match the previously checked public catalog. No inference was used to obtain
prices. Estimates are list-price USD before any account-specific terms/taxes.

At the **maximum 1536 output tokens**, the output component is **$0.00036864**.
Using the previous 637 input tokens as a planning reference gives
`(637 * 0.06 + 1536 * 0.24) / 1,000,000 = $0.00040686` (about $0.00041).
The new prompt is shorter, but its exact billed input-token count cannot be
established offline. A generous 2048-input-token allowance gives **$0.00049152**;
that allowance is an estimate, not a provider-enforced input-token cap.

For a deliberately conservative list-price ceiling independent of estimated prompt
tokenization, use the model's documented 262144-token context as an input upper
bound, plus the capped output: **$0.01609728**. This intentionally overcounts
shared context capacity and is far above the expected cost of the fixed short
prompt. Reliable actual cost requires the next response's usage; a timed-out or
truncated request can still be billed. No unlimited output budget is selected.

## Next command — not executed in Phase 7C

Wait for fresh explicit approval, then execute once:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m policyforge.nebius_smoke --execute-one-request
```

Stop after that single result, including any failure. Do not rerun, repair through
another model call, or launch the benchmark without separate authorization.
