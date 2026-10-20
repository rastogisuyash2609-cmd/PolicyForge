import assert from "node:assert/strict";
import test from "node:test";
import {
  activateDraft,
  demoDraft,
  emptyDraft,
  starterRule,
} from "../lib/policy-domain";
import {
  createApiClient,
  type DefaultData,
  type SimulateResponse,
  type SuiteResponse,
} from "../lib/api";

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

const client = createApiClient({ baseUrl: base });
test("real health and fixture responses satisfy runtime contracts", async () => {
  assert.equal((await client.health()).status, "ok");
  const fixtures = await client.getDefaultData();
  assert.equal(fixtures.rules_v1.length, 12);
  assert.equal(fixtures.rules_v2.length, 13);
});
test("typed simulation preserves intermediate states and equal-day input order", async () => {
  const fixtures = await client.getDefaultData();
  const result = await client.simulate({
    rules: fixtures.rules_v1,
    journey: [
      { event_type: "REFUND_REQUESTED", day: 15, payload: {} },
      { event_type: "ITEM_DELIVERED", day: 0, payload: {} },
      { event_type: "ORDER_PLACED", day: 0, payload: {} },
    ],
  });
  assert.deepEqual(
    result.trace.event_traces.map((e) => e.event_type),
    ["ITEM_DELIVERED", "ORDER_PLACED", "REFUND_REQUESTED"],
  );
  assert.equal(result.trace.event_traces[0].state_before.item_delivered, false);
  assert.equal(result.trace.event_traces[0].state_after.item_delivered, true);
  assert.equal(
    result.trace.event_traces[0].state_after.refund_requested,
    false,
  );
  assert.equal(result.final_state.refund_requested, true);
});
test("typed suite counters, nullable reductions and supported generators", async () => {
  const fixtures = await client.getDefaultData();
  for (const suite_type of ["boundary", "pairwise"] as const) {
    const result = await client.runSuite({
      rules: fixtures.rules_v1,
      suite_type,
      limit: 3,
    });
    assert.equal(result.total_scenarios, 3);
    assert.equal(result.passed_scenarios + result.failed_scenarios, 3);
    assert.equal(result.findings_count, result.findings.length);
    assert.match(result.summary_table, /Total Scenarios/);
  }
});
test("real shrinking preserves the canonical type/rule-ID target", async () => {
  const fixtures = await client.getDefaultData();
  const journey = fixtures.sample_journeys[0].journey;
  const original = await client.simulate({ rules: fixtures.rules_v1, journey });
  const target = original.findings.find((f) => f.type === "CONTRADICTION")!;
  const reduced = await client.shrink({
    rules: fixtures.rules_v1,
    journey,
    target_finding_type: target.type,
    target_rule_ids: target.rule_ids,
  });
  assert.equal(reduced.finding.type, target.type);
  assert.deepEqual(
    [...reduced.finding.rule_ids].sort(),
    [...target.rule_ids].sort(),
  );
  assert.ok(reduced.minimal_length <= reduced.original_length);
  const replay = await client.simulate({
    rules: fixtures.rules_v1,
    journey: reduced.minimal_journey,
  });
  assert.ok(
    replay.findings.some(
      (f) =>
        f.type === target.type &&
        JSON.stringify([...f.rule_ids].sort()) ===
          JSON.stringify([...target.rule_ids].sort()),
    ),
  );
});
test("real comparison covers shared samples, unchanged inputs and limited generated suites", async () => {
  const fixtures = await client.getDefaultData();
  const result = await client.diff({
    rules_v1: fixtures.rules_v1,
    rules_v2: fixtures.rules_v2,
    suite_type: "custom",
    custom_scenarios: fixtures.sample_journeys,
    limit: 5,
  });
  assert.equal(result.total_scenarios, 5);
  assert.ok(result.changed_rule_ids.length > 0);
  assert.ok(result.outcome_changes.length > 0);
  assert.ok(result.rule_text_diffs.some((d) => d.v1_summary === null));
  console.log(
    "PHASE5_DEMO_DIFF",
    JSON.stringify({
      journeys: result.total_scenarios,
      changedRuleIds: result.changed_rule_ids,
      allowToDenyEvents: result.outcomes_allow_to_deny,
      denyToAllowEvents: result.outcomes_deny_to_allow,
      changedEvents: result.outcome_changes.length,
      findingDeltaEntries: result.finding_deltas.length,
      reviewJourneys: result.scenarios_needing_review,
    }),
  );
  const unchanged = await client.diff({
    rules_v1: fixtures.rules_v1,
    rules_v2: fixtures.rules_v1,
    suite_type: "custom",
    custom_scenarios: fixtures.sample_journeys,
    limit: 5,
  });
  assert.equal(unchanged.outcome_changes.length, 0);
  assert.equal(unchanged.changed_rule_ids.length, 0);
  assert.equal(unchanged.finding_deltas.length, 0);
  for (const suite_type of ["boundary", "pairwise"] as const)
    assert.equal(
      (
        await client.diff({
          rules_v1: fixtures.rules_v1,
          rules_v2: fixtures.rules_v2,
          suite_type,
          limit: 3,
        })
      ).total_scenarios,
      3,
    );
});
