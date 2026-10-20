import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildComparison,
  capturePolicy,
  emptyComparison,
} from "../lib/comparison";
import { activateDraft, demoDraft } from "../lib/policy-domain";
import type { DefaultData, DiffResponse } from "../lib/api-types";
import { diffContract } from "../lib/api-contracts";
import { PolicyDiff } from "../components/screens/PolicyDiff";
import { createApiClient, ApiError } from "../lib/api";
const data: DefaultData = {
  documents: {},
  rules_v1: JSON.parse(readFileSync("../data/novacart/rules_v1.json", "utf8")),
  rules_v2: JSON.parse(readFileSync("../data/novacart/rules_v2.json", "utf8")),
  sample_journeys: [
    {
      id: "sample",
      name: "Refund journey",
      description: "Known journey",
      journey: [{ event_type: "REFUND_REQUESTED", day: 15 }],
    },
  ],
};
test("comparison sends selected rule sets and normalizes backend failures", async () => {
  const prepared = buildComparison(
    { ...emptyComparison(), baseline: "v1", candidate: "v2", limit: 1 },
    data,
    null,
    "[]",
    "",
  )!;
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      assert.ok(String(url).endsWith("/api/diff"));
      assert.deepEqual(JSON.parse(String(init?.body)), prepared.request);
      return new Response("Unavailable", { status: 503 });
    },
  });
  await assert.rejects(
    client.diff(prepared.request),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 503 &&
      !error.message.includes("Unavailable"),
  );
});
test("comparison requires explicit rule-set selections and guarded limits", () => {
  assert.equal(buildComparison(emptyComparison(), data, null, "[]", ""), null);
  assert.equal(
    buildComparison(
      { ...emptyComparison(), baseline: "v1", candidate: "snapshot" },
      data,
      null,
      "[]",
      "",
    ),
    null,
  );
  assert.equal(
    buildComparison(
      { ...emptyComparison(), baseline: "v1", candidate: "v2", limit: -1 },
      data,
      null,
      "[]",
      "",
    ),
    null,
  );
});
test("known comparison sends shared scenario arrays and original fixture rules", () => {
  const value = buildComparison(
    { ...emptyComparison(), baseline: "v1", candidate: "v2", limit: 1 },
    data,
    null,
    "[]",
    "",
  )!;
  assert.deepEqual(value.request.rules_v1, data.rules_v1);
  assert.deepEqual(value.request.rules_v2, data.rules_v2);
  assert.deepEqual(value.request.custom_scenarios, data.sample_journeys);
  assert.equal(value.request.suite_type, "custom");
  assert.equal(value.request.limit, 1);
  assert.match(value.scopeLabel, /cap 1/);
});
test("snapshot is an explicit immutable copy with provenance and revision", () => {
  const active = activateDraft(demoDraft(data, "v1"), 9).value!;
  const snapshot = capturePolicy(active);
  active.rules[0].name = "Subsequent edit";
  assert.notEqual(snapshot.rules[0].name, active.rules[0].name);
  const value = buildComparison(
    { ...emptyComparison(), baseline: "v2", candidate: "snapshot" },
    data,
    snapshot,
    "[]",
    "",
  )!;
  assert.match(value.candidateLabel, /snapshot · rev 9/);
  assert.deepEqual(value.request.rules_v2, snapshot.rules);
});
test("baseline-only boundaries and fixed patterns are explicitly labelled", () => {
  for (const suite of ["boundary", "pairwise"] as const) {
    const value = buildComparison(
      { baseline: "v1", candidate: "v2", suite, limit: 20 },
      data,
      null,
      "[]",
      "",
    )!;
    assert.equal(value.request.suite_type, suite);
    assert.match(
      value.scopeLabel,
      suite === "boundary" ? /baseline rules only/ : /fixed-pattern/,
    );
  }
});
test("current journey must validate and is shared identically on both engines", () => {
  const input = {
    ...emptyComparison(),
    baseline: "v1",
    candidate: "v2",
    suite: "current" as const,
  };
  assert.equal(buildComparison(input, data, null, "[]", ""), null);
  const value = buildComparison(
    input,
    data,
    null,
    '[{"event_type":"REFUND_REQUESTED","day":31}]',
    "Edited",
  )!;
  assert.equal(value.request.custom_scenarios?.[0].name, "Edited");
  assert.equal(value.request.custom_scenarios?.[0].journey[0].day, 31);
});
const coverage = {
  rule_coverage: 0,
  rules_fired: 0,
  rules_total: 1,
  uncovered_rule_ids: ["r"],
  event_type_coverage: 0,
  transitions_observed: 0,
};
const health = {
  score: 1,
  no_critical_findings: 1,
  rule_coverage: 0,
  no_gaps: 1,
  no_ambiguities: 1,
  event_coverage: 0,
};
const empty: DiffResponse = {
  total_scenarios: 1,
  changed_rule_ids: [],
  outcomes_allow_to_deny: 0,
  outcomes_deny_to_allow: 0,
  outcome_changes: [],
  finding_deltas: [],
  scenarios_needing_review: [],
  rule_text_diffs: [],
  coverage_v1: coverage,
  coverage_v2: coverage,
  health_v1: health,
  health_v2: health,
  summary: "actual",
};
test("comparison renders unchanged results without claiming exhaustive correctness", () => {
  const markup = renderToStaticMarkup(
    createElement(PolicyDiff, {
      data: empty,
      baselineLabel: "A",
      candidateLabel: "B",
      scopeLabel: "cap 20",
    }),
  );
  for (const text of [
    "No outcome or resolution changes",
    "cap 20",
    "Executed 1 journeys",
    "not exhaustive",
    "not accuracy",
    "source-only".replace("s", "S"),
  ])
    assert.ok(markup.includes(text), text);
});
test("comparison presents event counts and inconclusive backend attribution honestly", () => {
  const result = {
    ...empty,
    outcomes_allow_to_deny: 1,
    outcome_changes: [
      {
        scenario_id: "s",
        scenario_name: "Actual journey",
        event_index: 1,
        day: 31,
        event_type: "REFUND_REQUESTED",
        outcome_v1: "ALLOW",
        outcome_v2: "DENY",
        resolution_v1: "UNANIMOUS_ALLOW",
        resolution_v2: "UNANIMOUS_DENY",
        attributed_rule_ids: [],
        explanation: "actual backend note",
        needs_review: false,
      },
    ],
    rule_text_diffs: [
      {
        rule_id: "added",
        status: "ADDED" as const,
        v1_summary: null,
        v2_summary: "actual definition",
        changes: ["Actual addition"],
      },
    ],
  };
  const decoded = diffContract(result);
  assert.equal(decoded.rule_text_diffs[0].v1_summary, null);
  const markup = renderToStaticMarkup(
    createElement(PolicyDiff, {
      data: decoded,
      baselineLabel: "A",
      candidateLabel: "B",
      scopeLabel: "Known journeys",
    }),
  );
  for (const text of [
    "ALLOW → DENY events",
    "not distinct scenarios",
    "Attribution unavailable",
    "Actual journey",
    "actual backend note",
    "ADDED",
  ])
    assert.ok(markup.includes(text), text);
});
