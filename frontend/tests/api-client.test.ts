import assert from "node:assert/strict";
import test from "node:test";
import { createTransport, ApiError } from "../lib/http-client";
import { createApiClient } from "../lib/api";
import { healthContract, suiteContract } from "../lib/api-contracts";
import { starterRule } from "../lib/policy-domain";
import { LatestRequest } from "../lib/latest-request";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const expectKind = (kind: string) => (error: unknown) =>
  error instanceof ApiError && error.kind === kind;

test("out-of-order simulation replies cannot replace the newest request", async () => {
  const replies: Array<(response: Response) => void> = [];
  const client = createApiClient({
    fetchImpl: async () => new Promise((resolve) => replies.push(resolve)),
  });
  const gate = new LatestRequest();
  let committed = "";
  const input = {
    rules: [starterRule()],
    journey: [{ event_type: "REFUND_REQUESTED", day: 15 }],
  };
  const first = gate.begin();
  const old = client
    .simulate(input, first.signal)
    .then(() => {
      if (gate.current(first.id)) committed = "old";
    })
    .catch(() => {
      if (gate.current(first.id)) committed = "old error";
    });
  const second = gate.begin();
  const current = client.simulate(input, second.signal).then(() => {
    if (gate.current(second.id)) committed = "new";
  });
  replies[1](
    response({
      outcomes: [],
      final_state: {},
      trace: { event_traces: [] },
      findings: [],
    }),
  );
  await current;
  replies[0](
    response({
      outcomes: [],
      final_state: {},
      trace: { event_traces: [] },
      findings: [],
    }),
  );
  await old;
  assert.equal(committed, "new");
});
test("transport validates successful JSON and GET avoids Content-Type/preflight", async () => {
  const request = createTransport({
    baseUrl: "http://localhost:8000/",
    fetchImpl: async (url, init) => {
      assert.equal(url, "http://localhost:8000/api/health");
      assert.equal(init?.method, "GET");
      assert.equal(new Headers(init?.headers).has("Content-Type"), false);
      return response({ status: "ok", service: "PolicyForge" });
    },
  });
  assert.deepEqual(await request("/api/health", healthContract), {
    status: "ok",
    service: "PolicyForge",
  });
});
test("FastAPI detail arrays preserve field locations without object-string dumps", async () => {
  const request = createTransport({
    fetchImpl: async () =>
      response(
        {
          detail: [
            {
              loc: ["body", "rules", 0, "effect"],
              msg: "Invalid enum value",
              input: { secret: "not retained in diagnostics" },
              type: "enum",
            },
          ],
        },
        422,
      ),
  });
  await assert.rejects(request("/test", healthContract), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.match(error.message, /body.rules.0.effect: Invalid enum value/);
    assert.doesNotMatch(JSON.stringify(error.diagnostics), /secret/);
    return true;
  });
});
test("server exceptions stay in developer diagnostics, not user-facing text", async () => {
  const request = createTransport({
    fetchImpl: async () =>
      response({ detail: "RuntimeError: private traceback" }, 500),
  });
  await assert.rejects(request("/test", healthContract), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.match(error.message, /HTTP 500/);
    assert.doesNotMatch(error.message, /private|RuntimeError/);
    assert.ok(error.diagnostics);
    return true;
  });
});
test("non-JSON HTTP errors normalize safely", async () => {
  const request = createTransport({
    fetchImpl: async () =>
      new Response("<h1>Proxy error</h1>", { status: 502 }),
  });
  await assert.rejects(
    request("/test", healthContract),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 502 &&
      !error.message.includes("<h1>"),
  );
});
test("malformed, HTML, empty JSON and schema mismatches are explicit errors", async () => {
  for (const body of ["{broken", "<html>wrong backend</html>", ""])
    await assert.rejects(
      createTransport({ fetchImpl: async () => new Response(body) })(
        "/test",
        healthContract,
      ),
      expectKind("invalid-json"),
    );
  await assert.rejects(
    createTransport({ fetchImpl: async () => response({ status: "ok" }) })(
      "/test",
      healthContract,
    ),
    expectKind("contract"),
  );
});
test("network failure has an actionable connection message", async () => {
  const request = createTransport({
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  await assert.rejects(
    request("/test", healthContract),
    (error: unknown) =>
      error instanceof ApiError &&
      error.kind === "network" &&
      error.message.includes("FastAPI"),
  );
});
const stalled: typeof fetch = async (_url, init) =>
  new Promise((_resolve, reject) =>
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    ),
  );
test("timeout aborts request and reports that server work may continue", async () => {
  await assert.rejects(
    createTransport({ fetchImpl: stalled, timeoutMs: 5 })(
      "/test",
      healthContract,
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.kind === "timeout" &&
      error.message.includes("still be processing"),
  );
});
test("caller cancellation and pre-aborted signals are distinct from outages", async () => {
  const controller = new AbortController();
  const pending = createTransport({ fetchImpl: stalled })(
    "/test",
    healthContract,
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, expectKind("cancelled"));
  let calls = 0;
  await assert.rejects(
    createTransport({
      fetchImpl: async () => {
        calls++;
        return response({});
      },
    })("/test", healthContract, { signal: controller.signal }),
    expectKind("cancelled"),
  );
  assert.equal(calls, 0);
});
test("nullable/absent suite shrinking remains nullable, not fabricated", () => {
  for (const shrink of [null, undefined]) {
    const result = suiteContract({
      total_scenarios: 1,
      passed_scenarios: 0,
      failed_scenarios: 1,
      total_findings: 1,
      findings_count: 1,
      findings: [
        {
          signature: ["POLICY_GAP", []],
          finding: {
            type: "POLICY_GAP",
            severity: "MEDIUM",
            rule_ids: [],
            event_indices: [0],
            trace: "Actual trace",
            details: null,
          },
          shrink,
        },
      ],
      summary_table: "Actual summary",
    });
    assert.equal(result.findings[0].shrink, shrink);
    assert.equal(result.findings[0].finding.details, null);
  }
});
test("fractional or negative suite counts fail the response contract", async () => {
  for (const total of [-1, 1.5]) {
    const client = createApiClient({
      fetchImpl: async () =>
        response({
          total_scenarios: total,
          passed_scenarios: 0,
          failed_scenarios: 0,
          total_findings: 0,
          findings_count: 0,
          findings: [],
          summary_table: "bad count",
        }),
    });
    await assert.rejects(
      client.runSuite({
        rules: [starterRule()],
        suite_type: "pairwise",
        limit: 1,
      }),
      expectKind("contract"),
    );
  }
});
test("typed client serializes custom active rules without substituting fixtures", async () => {
  const rules = [{ ...starterRule(), id: "explicit_custom" }];
  const client = createApiClient({
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.rules, rules);
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "application/json",
      );
      return response({
        outcomes: [],
        findings: [],
        final_state: {},
        trace: { event_traces: [] },
      });
    },
  });
  await client.simulate({
    rules,
    journey: [{ event_type: "ITEM_DELIVERED", day: 0 }],
  });
});
test("unsafe fallback suites, invalid limits and input never reach the network", async () => {
  let calls = 0;
  const client = createApiClient({
    fetchImpl: async () => {
      calls++;
      return response({});
    },
  });
  for (const options of [
    { suite_type: "custom" as const, custom_scenarios: [] },
    { suite_type: "novacart" as never },
    { limit: -1 },
    { limit: 0 },
    { limit: 201 },
  ])
    await assert.rejects(
      client.runSuite({ rules: [starterRule()], ...options }),
      expectKind("validation"),
    );
  await assert.rejects(
    client.simulate({
      rules: [starterRule()],
      journey: [{ event_type: "ITEM_DELIVERED", day: -1 }],
    }),
    expectKind("validation"),
  );
  assert.equal(calls, 0);
});
test("offline compile guard issues no HTTP request", async () => {
  let calls = 0;
  const client = createApiClient({
    fetchImpl: async () => {
      calls++;
      return response({});
    },
  });
  await assert.rejects(
    client.compile({ document_text: "text" }),
    expectKind("disabled"),
  );
  assert.equal(calls, 0);
});
