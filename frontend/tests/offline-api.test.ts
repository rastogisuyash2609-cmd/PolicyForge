import assert from "node:assert/strict";
import test from "node:test";
import {
  activateDraft,
  demoDraft,
  emptyDraft,
  starterRule,
} from "../lib/policy-domain";
import type { DefaultData, SimulateResponse, SuiteResponse } from "../lib/api";

const base = process.env.POLICYFORGE_TEST_API ?? "http://127.0.0.1:8000";
async function post<T>(endpoint: string, payload: unknown): Promise<T> {
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<T>;
}
test("real local demo activation → suite → contradictory simulation", async () => {
  const response = await fetch(`${base}/api/default-data`);
  assert.equal(response.status, 200);
  const data = (await response.json()) as DefaultData;
  const active = activateDraft(demoDraft(data, "v1"), 1).value!;
  const suite = await post<SuiteResponse>("/api/run-suite", {
    rules: active.rules,
    suite_type: "custom",
    custom_scenarios: data.sample_journeys,
    limit: data.sample_journeys.length,
  });
  assert.equal(suite.total_scenarios, 5);
  assert.equal(suite.findings_count, 2);
  const result = await post<SimulateResponse>("/api/simulate", {
    rules: active.rules,
    journey: data.sample_journeys[0].journey,
  });
  assert.ok(
    result.findings.some((finding) => finding.type === "CONTRADICTION"),
  );
  assert.ok(result.trace.event_traces.at(-1)?.suppressed_rules);
  assert.equal(result.outcomes.at(-1)?.outcome, "DENY");
});
test("real local manually authored rules → allowed then default-denied boundary", async () => {
  const active = activateDraft(
    {
      ...emptyDraft(),
      mode: "manual",
      name: "Integration manual refund",
      rulesJson: JSON.stringify([starterRule()]),
    },
    2,
  ).value!;
  for (const [day, outcome, findings] of [
    [15, "ALLOW", 0],
    [31, "DENY", 1],
  ] as const) {
    const result = await post<SimulateResponse>("/api/simulate", {
      rules: active.rules,
      journey: [
        { event_type: "ITEM_DELIVERED", day: 0, payload: {} },
        { event_type: "REFUND_REQUESTED", day, payload: {} },
      ],
    });
    assert.equal(result.outcomes.at(-1)?.outcome, outcome);
    assert.equal(result.findings.length, findings);
    assert.equal(
      result.trace.event_traces[1].evaluations[0].rule_id,
      active.rules[0].id,
    );
  }
});
test("real backend rejects invalid closed-vocabulary rules (422)", async () => {
  const response = await fetch(`${base}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rules: [{ ...starterRule(), decision: "LOAN" }],
      journey: [],
    }),
  });
  assert.equal(response.status, 422);
});
