import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  activateDraft,
  demoDraft,
  emptyDraft,
  editableRules,
  EVENTS,
  FIELD_TYPES,
  OPERATORS,
  starterRule,
  validateJourney,
  validateRules,
} from "../lib/policy-domain";
import type { DefaultData, PolicyRule, SimulateResponse } from "../lib/api";
import { LatestRequest } from "../lib/latest-request";
import { RuleInspector } from "../components/policy/rule-inspector";
import { ConditionEditor } from "../components/policy/condition-editor";
import { SimulationResults } from "../components/policy/simulation-results";

const rules = JSON.parse(
  readFileSync("../data/novacart/rules_v1.json", "utf8"),
) as PolicyRule[];
const data: DefaultData = {
  rules_v1: rules,
  rules_v2: JSON.parse(readFileSync("../data/novacart/rules_v2.json", "utf8")),
  documents: { "policy.md": "Actual document content" },
  sample_journeys: [],
};
test("empty editor cannot activate and prose alone never supplies rules", () => {
  assert.equal(activateDraft(emptyDraft(), 1).value, null);
  const draft = {
    ...emptyDraft(),
    mode: "manual" as const,
    name: "Custom prose",
    text: "Refund everything forever",
  };
  assert.equal(activateDraft(draft, 1).value, null);
});
test("demo choices load exact repository rules without compilation", () => {
  for (const example of ["v1", "v2"] as const) {
    const draft = demoDraft(data, example),
      active = activateDraft(draft, 1);
    assert.deepEqual(active.errors, []);
    assert.deepEqual(
      active.value?.rules,
      example === "v1" ? data.rules_v1 : data.rules_v2,
    );
    assert.equal(active.value?.origin, "demo");
    assert.match(draft.text, /Actual document content/);
  }
});
test("manual activation snapshots rules and revision without mutating the draft", () => {
  const draft = {
    ...emptyDraft(),
    mode: "manual" as const,
    name: "My refund policy",
    rulesJson: JSON.stringify([starterRule()]),
  };
  const first = activateDraft(draft, 7).value!;
  const changed = {
    ...draft,
    rulesJson: JSON.stringify([{ ...starterRule(), effect: "DENY" }]),
  };
  const second = activateDraft(changed, 8).value!;
  assert.equal(first.origin, "manual");
  assert.equal(first.rules[0].effect, "ALLOW");
  assert.equal(first.revision, 7);
  assert.equal(second.revision, 8);
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.match(first.warnings[0], /no source quotation/);
});
test("malformed, empty and unsupported rules cannot activate", () => {
  for (const input of [
    "{",
    "{}",
    "[]",
    "null",
    JSON.stringify([{ ...starterRule(), decision: "LOAN" }]),
    JSON.stringify([{ ...starterRule(), trigger: "ORDER_PLACED" }]),
    JSON.stringify([{ ...starterRule(), arbitrary: true }]),
    JSON.stringify([{ ...starterRule(), source: null }]),
    JSON.stringify([{ ...starterRule(), priority: 1.5 }]),
  ])
    assert.equal(validateRules(input).value, null, input);
});
test("condition validation rejects unknown fields/ops, mixed nodes and wrong scalar types", () => {
  const bad = [
    { field: "credit_score", op: "GT", value: 30 },
    { field: "days_since_delivery", op: "EXEC", value: 1 },
    { all: [], any: [] },
    { all: "bad" },
    { field: "days_since_delivery", op: "LTE", value: "30" },
    { field: "item_delivered", op: "GT", value: true },
    { field: "customer_tier", op: "EQ", value: "GOLD" },
    { field: "item_delivered", op: "IN", value: "true" },
    { field: "days_since_delivery", op: "LT", value: null },
  ];
  for (const when of bad)
    assert.equal(
      validateRules(JSON.stringify([{ ...starterRule(), when }])).value,
      null,
      JSON.stringify(when),
    );
  assert.ok(
    validateRules(
      JSON.stringify([
        {
          ...starterRule(),
          when: {
            any: [
              {
                all: [
                  {
                    field: "customer_tier",
                    op: "IN",
                    value: ["VIP", "STANDARD"],
                  },
                ],
              },
              { field: "delivery_day", op: "IS_NULL" },
            ],
          },
        },
      ]),
    ).value,
  );
});
test("duplicate IDs and invalid override relationships are rejected", () => {
  const a = starterRule(),
    b = { ...starterRule(2), effect: "DENY" as const };
  const cases = [
    [a, a],
    [{ ...a, overrides: ["missing"] }],
    [{ ...a, overrides: [a.id] }],
    [
      { ...a, overrides: [b.id] },
      { ...b, overrides: [a.id] },
    ],
    [{ ...a, overrides: [b.id, b.id] }, b],
    [
      { ...a, overrides: [b.id] },
      { ...b, decision: "REPLACEMENT", trigger: "REPLACEMENT_REQUESTED" },
    ],
  ];
  for (const value of cases)
    assert.equal(validateRules(JSON.stringify(value)).value, null);
  assert.ok(
    validateRules(JSON.stringify([{ ...a, overrides: [b.id] }, b])).value,
  );
});
test("state updates require supported fields and exact scalar types", () => {
  for (const state_updates of [
    { is_final_sale: "false" },
    { amount_paid: -1 },
    { unknown: true },
    { delivery_day: 2.2 },
    { customer_tier: "GOLD" },
    [],
  ])
    assert.equal(
      validateRules(JSON.stringify([{ ...starterRule(), state_updates }]))
        .value,
      null,
    );
  assert.ok(
    validateRules(
      JSON.stringify([
        {
          ...starterRule(),
          state_updates: {
            refund_eligibility_restored: true,
            delivery_day: null,
          },
        },
      ]),
    ).value,
  );
});
test("editable shape supports intermediate invalid IDs without permitting activation", () => {
  const input = JSON.stringify([{ ...starterRule(), id: "" }]);
  assert.ok(editableRules(input));
  assert.equal(validateRules(input).value, null);
  assert.equal(editableRules('[{"when":{"all":"bad"}}]'), null);
});
test("scenario validation rejects unknown payloads/events and preserves stable chronology", () => {
  const input = [
    { event_type: "REFUND_REQUESTED", day: 30 },
    { event_type: "ITEM_DELIVERED", day: 0 },
    { event_type: "REPLACEMENT_CANCELLED", day: 30 },
  ];
  const valid = validateJourney(JSON.stringify(input));
  assert.deepEqual(
    valid.value?.map((e) => e.event_type),
    input.map((e) => e.event_type),
  );
  assert.match(valid.warnings[0], /ascending/);
  for (const value of [
    [],
    null,
    [{ event_type: "PAYOUT", day: 1 }],
    [{ event_type: "ITEM_DELIVERED", day: -1 }],
    [
      {
        event_type: "ITEM_DELIVERED",
        day: 0,
        payload: { is_final_sale: "false" },
      },
    ],
    [{ event_type: "ORDER_PLACED", day: 0, payload: { unsupported: true } }],
  ])
    assert.equal(validateJourney(JSON.stringify(value)).value, null);
});
test("request replacement, cancellation and revision teardown reject stale results", async () => {
  const channel = new LatestRequest(),
    first = channel.begin(),
    second = channel.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(channel.current(first.id), false);
  assert.equal(channel.current(second.id), true);
  let committed = "";
  const delayed = Promise.resolve().then(() => {
    if (channel.current(second.id)) committed = "old policy";
  });
  channel.cancel();
  await delayed;
  assert.equal(committed, "");
  assert.equal(second.signal.aborted, true);
  const newer = channel.begin();
  assert.ok(channel.current(newer.id));
});
test("editor and inspector render labelled conditions, origins and real source information", () => {
  const markup = renderToStaticMarkup(
    createElement(ConditionEditor, {
      value: { field: "item_delivered", op: "IS_TRUE", value: true },
      onChange: () => {},
    }),
  );
  assert.match(markup, /Condition state field/);
  assert.match(markup, /Condition operation/);
  assert.match(markup, /<select/);
  const inspector = renderToStaticMarkup(
    createElement(RuleInspector, { rule: rules[0], manual: true }),
  );
  assert.match(inspector, /not independently verified/);
  assert.match(inspector, /Standard 30-day refund window/);
  assert.match(inspector, /Rule specification/);
  assert.doesNotMatch(inspector, /confidence|AI generated/i);
});
test("result view separates event-local state from final state and qualifies zero findings", () => {
  const result: SimulateResponse = {
    outcomes: [
      {
        event_index: 0,
        day: 15,
        event_type: "REFUND_REQUESTED",
        outcome: "ALLOW",
        action_applied: true,
        resolution_type: "UNANIMOUS_ALLOW",
        findings: [],
      },
    ],
    findings: [],
    final_state: { refund_requested: true },
    trace: {
      event_traces: [
        {
          event_index: 0,
          day: 15,
          event_type: "REFUND_REQUESTED",
          is_decision_event: true,
          rules_evaluated: [],
          rules_fired: [],
          active_rules: [],
          suppressed_rules: [],
          findings: [],
          evaluations: [],
          resolution_type: "UNANIMOUS_ALLOW",
          outcome: "ALLOW",
          explanation: "Actual engine explanation",
          state_before: { refund_requested: false },
          state_after: { refund_requested: true },
        },
      ],
    },
  };
  const markup = renderToStaticMarkup(
    createElement(SimulationResults, {
      result,
      policyName: "Manual policy",
      scenarioName: "My journey",
      rules: [],
    }),
  );
  for (const text of [
    "Manual policy",
    "My journey",
    "Request allowed",
    "Actual engine explanation",
    "does not establish complete",
    "State before / after this event",
    "Suppressed rules",
    "Final state is after the entire journey",
  ])
    assert.ok(markup.includes(text), text);
});
test("closed vocabularies remain aligned with Python source enums", () => {
  const source = readFileSync("../backend/policyforge/models.py", "utf8");
  for (const [name, entries] of [
    ["EventType", EVENTS],
    ["StateField", Object.keys(FIELD_TYPES)],
    ["Operator", OPERATORS],
  ] as const) {
    const block = source
      .split(`class ${name}(`)[1]
      .split("\nclass ")[0]
      .split("    @classmethod")[0];
    const values = Array.from(
      block.matchAll(/^    [A-Z_]+ = "([^"]+)"/gm),
      (match) => match[1],
    );
    assert.deepEqual([...entries].sort(), values.sort(), `${name} drifted`);
  }
});
