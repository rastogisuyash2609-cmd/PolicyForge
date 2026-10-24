import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  activateDraft,
  emptyDraft,
  starterRule,
  type Scenario,
} from "../lib/policy-domain";
import { buildStress, signatureBreakdown, retainedEvents } from "../lib/stress";
import {
  createReport,
  reportJson,
  reportMarkdown,
  reportIsCurrent,
  reportFilename,
} from "../lib/reports";
import { createApiClient, ApiError } from "../lib/api";
import { suiteContract } from "../lib/api-contracts";
import { executionJourney } from "../lib/execution";
import { ReportView } from "../components/policy/report-view";
import { Counterexample } from "../components/policy/counterexample";
import { SimulationResults } from "../components/policy/simulation-results";
import type {
  SuiteResponse,
  SimulateResponse,
  DiffResponse,
} from "../lib/api-types";
const active = activateDraft(
  {
    ...emptyDraft(),
    mode: "manual",
    name: "Phase 6 manual",
    rulesJson: JSON.stringify([starterRule()]),
  },
  7,
).value!;
const scenarios: Scenario[] = [
  {
    id: "known",
    name: "Known input",
    description: "Explicit scope",
    journey: [{ event_type: "REFUND_REQUESTED", day: 31, payload: {} }],
  },
];
const finding = {
  type: "POLICY_GAP",
  severity: "MEDIUM",
  rule_ids: [],
  event_indices: [0],
  trace: "Actual backend trace",
  details: null,
};
const suite: SuiteResponse = {
  total_scenarios: 8,
  passed_scenarios: 5,
  failed_scenarios: 3,
  total_findings: 6,
  findings_count: 1,
  findings: [{ signature: ["POLICY_GAP", []], finding, shrink: null }],
  summary_table: "Backend Markdown table",
};
test("stress supports only explicit valid suites, active rules and positive bounded caps", () => {
  for (const limit of [0, -1, 201, 1.5, NaN])
    assert.equal(
      buildStress({ suite: "boundary", limit }, active, scenarios),
      null,
    );
  assert.equal(
    buildStress({ suite: "boundary", limit: 1 }, null, scenarios),
    null,
  );
  assert.equal(buildStress({ suite: "custom", limit: 1 }, active, []), null);
  assert.equal(
    buildStress(
      { suite: "novacart" as "boundary", limit: 1 },
      active,
      scenarios,
    ),
    null,
  );
  for (const type of ["boundary", "pairwise", "custom"] as const) {
    const p = buildStress({ suite: type, limit: 4 }, active, scenarios)!;
    assert.deepEqual(p.request.rules, active.rules);
    assert.equal(p.request.suite_type, type);
    assert.equal(p.request.limit, 4);
    assert.equal(p.request.default_decision_outcome, "DENY");
    assert.equal(!!p.request.custom_scenarios, type === "custom");
  }
});
test("stress request uses actual selected payload and normalizes errors with successful retry", async () => {
  const p = buildStress({ suite: "custom", limit: 1 }, active, scenarios)!;
  let calls = 0;
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      assert.ok(String(url).endsWith("/api/run-suite"));
      assert.deepEqual(JSON.parse(String(init?.body)), p.request);
      calls++;
      return calls === 1
        ? new Response("failure", { status: 503 })
        : Response.json(suite);
    },
  });
  await assert.rejects(
    client.runSuite(p.request),
    (e: unknown) => e instanceof ApiError && e.status === 503,
  );
  assert.deepEqual(await client.runSuite(p.request), suite);
});
test("signature breakdown never presents unique groups as occurrence frequencies", () => {
  assert.deepEqual(signatureBreakdown(suite, "type"), [["POLICY_GAP", 1]]);
  assert.deepEqual(signatureBreakdown(suite, "severity"), [["MEDIUM", 1]]);
  assert.equal(suite.total_findings, 6);
});
test("nullable reductions stay missing and render an honest explanation", () => {
  assert.equal(suiteContract(suite).findings[0].shrink, null);
  const html = renderToStaticMarkup(
    createElement(Counterexample, { item: suite.findings[0], active }),
  );
  assert.match(html, /No reduction was returned/);
  assert.doesNotMatch(html, /Replay reduced journey/);
});
test("counterexample alignment handles removed events and changed days without engine inference", () => {
  const original = [
    { event_type: "ITEM_DELIVERED", day: 0 },
    { event_type: "ORDER_PLACED", day: 1 },
    { event_type: "REFUND_REQUESTED", day: 31 },
  ];
  assert.deepEqual(
    retainedEvents(original, [original[0], { ...original[2], day: 1 }]),
    [true, false, true],
  );
});
test("suite report preserves exact policy revision, inputs, all counters and backend notes", () => {
  const p = buildStress({ suite: "custom", limit: 4 }, active, scenarios)!;
  const r = createReport(
    { kind: "stress", request: p.request, result: suite },
    active,
    p.scope,
  );
  assert.equal(r.rule_sets[0].revision, 7);
  assert.equal(r.rule_sets[0].origin, "manual");
  assert.deepEqual(r.rule_sets[0].rules, active.rules);
  assert.deepEqual(r.metrics, {
    journeys_executed: 8,
    journeys_with_findings: 3,
    finding_occurrences: 6,
    unique_signatures: 1,
  });
  assert.equal(r.backend_markdown, suite.summary_table);
  assert.deepEqual(r.request, p.request);
});
test("report exports are valid JSON and Markdown with reproducible evidence and safe fences", () => {
  const r = createReport(
    {
      kind: "stress",
      request: buildStress({ suite: "custom", limit: 4 }, active, scenarios)!
        .request,
      result: suite,
    },
    active,
    "Selected journeys",
  );
  r.rule_sets[0].rules[0].source.verbatim_sentence = "Source with ``` fence";
  const json = reportJson(r);
  assert.deepEqual(JSON.parse(json), r);
  const md = reportMarkdown(r);
  for (const text of [
    "Selected journeys",
    "revision 7",
    "Backend Markdown table",
    "Actual backend trace",
    "Complete reproducible evidence",
    "globally shortest",
    "````json",
  ])
    assert.ok(md.includes(text), text);
  assert.equal(reportFilename(r, "json"), "policyforge-stress-rev-7.json");
});
test("export is a detached snapshot and invalidates when active revision or identity changes", () => {
  const source = JSON.parse(JSON.stringify(suite)) as SuiteResponse;
  const r = createReport(
    {
      kind: "stress",
      request: buildStress({ suite: "custom", limit: 4 }, active, scenarios)!
        .request,
      result: source,
    },
    active,
    "Selected",
  );
  source.findings[0].finding.trace = "mutated";
  assert.equal(r.findings[0].trace, "Actual backend trace");
  assert.ok(reportIsCurrent(r, active));
  assert.equal(reportIsCurrent(r, { ...active, revision: 8 }), false);
  assert.equal(reportIsCurrent(r, { ...active, fingerprint: "other" }), false);
  assert.equal(reportIsCurrent(r, null), false);
});
test("readable report and download links expose actual counters and provenance", () => {
  const r = createReport(
    {
      kind: "stress",
      request: buildStress({ suite: "custom", limit: 4 }, active, scenarios)!
        .request,
      result: suite,
    },
    active,
    "Selected",
  );
  const html = renderToStaticMarkup(createElement(ReportView, { report: r }));
  for (const text of [
    "Phase 6 manual",
    "revision 7",
    "Finding occurrences",
    "Unique signatures",
    "Actual backend trace",
    "Download Markdown",
    "Download JSON",
    "data:application/json",
    "policyforge-stress-rev-7.json",
    "No source quotation supplied",
  ])
    assert.ok(html.includes(text), text);
});
const simulation: SimulateResponse = {
  outcomes: [],
  findings: [],
  final_state: { refund_requested: true },
  trace: {
    event_traces: [
      {
        event_index: 0,
        day: 0,
        event_type: "ITEM_DELIVERED",
        is_decision_event: false,
        rules_evaluated: [],
        rules_fired: [],
        active_rules: [],
        suppressed_rules: [],
        findings: [],
        evaluations: [],
        resolution_type: "NON_DECISION",
        outcome: "ALLOW",
        explanation: "Recorded delivery event",
        state_before: { item_delivered: false, refund_requested: false },
        state_after: { item_delivered: true, refund_requested: false },
      },
    ],
  },
};
test("execution association sorts days stably and preserves original payload identity", () => {
  const journey = [
    {
      event_type: "REFUND_REQUESTED",
      day: 31,
      payload: { customer_tier: "VIP" },
    },
    { event_type: "ITEM_DELIVERED", day: 0, payload: { amount_paid: 100 } },
    { event_type: "ORDER_PLACED", day: 0, payload: { amount_paid: 200 } },
  ];
  assert.deepEqual(
    executionJourney(journey).map((e) => e.inputIndex),
    [1, 2, 0],
  );
  assert.equal(journey[0].day, 31);
  const html = renderToStaticMarkup(
    createElement(SimulationResults, {
      result: simulation,
      policyName: "Manual rev 7",
      scenarioName: "Unsorted",
      rules: active.rules,
      journey,
    }),
  );
  for (const text of [
    "amount_paid",
    "100",
    "input event 2",
    "Non-decision event",
    "Recorded delivery event",
    "Event findings:",
    "State before / after this event",
  ])
    assert.ok(html.includes(text), text);
});
test("simulation reports include event-local states and exact original journey", () => {
  const r = createReport(
    {
      kind: "simulation",
      request: { rules: active.rules, journey: scenarios[0].journey },
      result: simulation,
    },
    active,
    "One journey",
  );
  assert.equal(r.metrics.events_executed, 1);
  assert.match(reportJson(r), /state_before/);
  assert.deepEqual(r.request, {
    rules: active.rules,
    journey: scenarios[0].journey,
  });
});
test("comparison report keeps fixture and snapshot provenance distinct from workspace revision", () => {
  const diff: DiffResponse = {
    total_scenarios: 1,
    changed_rule_ids: [],
    outcomes_allow_to_deny: 0,
    outcomes_deny_to_allow: 0,
    outcome_changes: [],
    finding_deltas: [],
    scenarios_needing_review: [],
    rule_text_diffs: [],
    coverage_v1: {
      rule_coverage: 0,
      rules_fired: 0,
      rules_total: 1,
      uncovered_rule_ids: [],
      event_type_coverage: 0,
      transitions_observed: 0,
    },
    coverage_v2: {
      rule_coverage: 0,
      rules_fired: 0,
      rules_total: 1,
      uncovered_rule_ids: [],
      event_type_coverage: 0,
      transitions_observed: 0,
    },
    health_v1: {
      score: 0,
      no_critical_findings: 0,
      rule_coverage: 0,
      no_gaps: 0,
      no_ambiguities: 0,
      event_coverage: 0,
    },
    health_v2: {
      score: 0,
      no_critical_findings: 0,
      rule_coverage: 0,
      no_gaps: 0,
      no_ambiguities: 0,
      event_coverage: 0,
    },
    summary: "No observed changes",
  };
  const r = createReport(
    {
      kind: "comparison",
      request: {
        rules_v1: active.rules,
        rules_v2: active.rules,
        suite_type: "boundary",
        limit: 1,
      },
      result: diff,
    },
    active,
    "Baseline boundaries; cap 1",
    [
      {
        label: "NovaCart v1",
        origin: "Repository demo fixture",
        revision: null,
      },
      {
        label: "Manual capture",
        origin: "manual captured snapshot",
        revision: 7,
        fingerprint: active.fingerprint,
      },
    ],
  );
  assert.equal(r.rule_sets[0].revision, null);
  assert.equal(r.rule_sets[1].revision, 7);
  assert.equal(r.metrics.changed_events, 0);
  assert.equal(r.backend_markdown, "No observed changes");
  assert.match(
    reportMarkdown(r),
    /repository fixture \(no workspace revision\)/,
  );
});
