// Read-only local diagnostics, not acceptance tests for defective backend behavior.
// No compile requests and no benchmark artifacts. Prints observations for coordination.
import { starterRule } from "../lib/policy-domain";
const base = process.env.POLICYFORGE_TEST_API ?? "http://127.0.0.1:8000";
async function post(path: string, body: unknown) {
  const response = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}
async function main() {
  const rules = [starterRule()];
  const results: Record<string, unknown> = {};
  for (const [name, journey] of [
    ["negativeDay", [{ event_type: "ITEM_DELIVERED", day: -1 }]],
    [
      "unknownPayload",
      [
        {
          event_type: "ITEM_DELIVERED",
          day: 0,
          payload: { unknown_field: true },
        },
      ],
    ],
    [
      "stringBooleanCoercion",
      [
        {
          event_type: "ITEM_DELIVERED",
          day: 0,
          payload: { is_final_sale: "false" },
        },
      ],
    ],
  ] as const) {
    const value = await post("simulate", { rules, journey });
    results[name] = { status: value.status, state: value.body.final_state };
  }
  const invalidCustom = await post("run-suite", {
    rules,
    suite_type: "custom",
    custom_scenarios: [
      {
        id: "bad",
        name: "Bad event",
        journey: [{ event_type: "UNSUPPORTED", day: 0 }],
      },
    ],
    limit: 1,
  });
  results.invalidCustomEvent = { status: invalidCustom.status };
  for (const suite_type of ["boundary", "novacart", "custom"]) {
    const value = await post("run-suite", {
      rules,
      suite_type,
      custom_scenarios: [],
      limit: 1,
    });
    results[`${suite_type}EmptyCustom`] = {
      status: value.status,
      journeys: value.body.total_scenarios,
      findings: value.body.findings_count,
    };
  }
  for (const limit of [0, -1]) {
    const value = await post("run-suite", {
      rules,
      suite_type: "pairwise",
      limit,
    });
    results[`limit${limit}`] = {
      status: value.status,
      journeys: value.body.total_scenarios,
    };
  }
  for (const [name, value] of [
    ["duplicateIds", [starterRule(), starterRule()]],
    ["missingOverride", [{ ...starterRule(), overrides: ["missing"] }]],
  ] as const) {
    const reply = await post("simulate", {
      rules: value,
      journey: [{ event_type: "ITEM_DELIVERED", day: 0 }],
    });
    results[name] = { status: reply.status };
  }
  const invariants = await post("simulate", {
    rules,
    journey: [
      { event_type: "ORDER_PLACED", day: 0, payload: { amount_paid: 100 } },
      {
        event_type: "REFUND_COMPLETED",
        day: 1,
        payload: { refund_amount: 200 },
      },
      { event_type: "REPLACEMENT_DELIVERED", day: 2 },
    ],
  });
  results.invariantIdentities = invariants.body.findings;
  const attribution = await post("diff", {
    rules_v1: [starterRule()],
    rules_v2: [{ ...starterRule(), effect: "DENY" }],
    suite_type: "custom",
    custom_scenarios: [
      {
        id: "same_rule",
        name: "Same ID effect edit",
        journey: [
          { event_type: "ITEM_DELIVERED", day: 0 },
          { event_type: "REFUND_REQUESTED", day: 1 },
        ],
      },
    ],
    limit: 1,
  });
  results.sameFiredIdsAttribution = attribution.body.outcome_changes;
  const sourceOnly = await post("diff", {
    rules_v1: rules,
    rules_v2: [
      {
        ...starterRule(),
        source: {
          doc_name: "Changed source",
          verbatim_sentence: "Only source changed",
        },
      },
    ],
    suite_type: "pairwise",
    limit: 1,
  });
  results.sourceOnlyChange = sourceOnly.body.changed_rule_ids;
  const openapi = (await (await fetch(`${base}/openapi.json`)).json()) as {
    paths: Record<
      string,
      Record<
        string,
        {
          responses: Record<
            string,
            { content?: Record<string, { schema?: unknown }> }
          >;
        }
      >
    >;
  };
  results.openApiSuccessSchemas = Object.fromEntries(
    Object.entries(openapi.paths)
      .filter(([path]) => path.startsWith("/api/"))
      .map(([path, methods]) => [
        path,
        Object.values(methods)[0].responses["200"]?.content?.[
          "application/json"
        ]?.schema,
      ]),
  );
  console.log(JSON.stringify(results, null, 2));
}
void main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exitCode = 1;
});
