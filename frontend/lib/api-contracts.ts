import type { Decoder } from "./http-client";
import type {
  DefaultData,
  CompileResponse,
  DiffResponse,
  Finding,
  HealthResponse,
  PolicyRule,
  ShrinkResponse,
  SimulateResponse,
  SuiteResponse,
} from "./api-types";

const fail = (path: string, expected: string): never => {
  throw new Error(`${path}: expected ${expected}`);
};
const str: Decoder<string> = (v, p = "response") =>
  typeof v === "string" ? v : fail(p, "string");
const num: Decoder<number> = (v, p = "response") =>
  typeof v === "number" && Number.isFinite(v) ? v : fail(p, "finite number");
const integer: Decoder<number> = (v, p = "response") =>
  typeof v === "number" && Number.isSafeInteger(v)
    ? v
    : fail(p, "safe integer");
const count: Decoder<number> = (v, p = "response") =>
  integer(v, p) >= 0 ? (v as number) : fail(p, "non-negative count");
const bool: Decoder<boolean> = (v, p = "response") =>
  typeof v === "boolean" ? v : fail(p, "boolean");
const record: Decoder<Record<string, unknown>> = (v, p = "response") =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail(p, "object");
const array =
  <T>(decode: Decoder<T>): Decoder<T[]> =>
  (v, p = "response") =>
    Array.isArray(v)
      ? v.map((entry, i) => decode(entry, `${p}[${i}]`))
      : fail(p, "array");
const nullable =
  <T>(decode: Decoder<T>): Decoder<T | null> =>
  (v, p) =>
    v === null ? null : decode(v, p);
const optional =
  <T>(decode: Decoder<T>): Decoder<T | undefined> =>
  (v, p) =>
    v === undefined ? undefined : decode(v, p);
type Result<D> = D extends Decoder<infer T> ? T : never;
function shape<S extends Record<string, Decoder<unknown>>>(
  fields: S,
): Decoder<{ [K in keyof S]: Result<S[K]> }> {
  return (v, p = "response") => {
    const input = record(v, p);
    const output: Record<string, unknown> = { ...input };
    for (const key of Object.keys(fields))
      output[key] = fields[key](input[key], `${p}.${key}`);
    return output as { [K in keyof S]: Result<S[K]> };
  };
}
const literal =
  <T extends string>(values: readonly T[]): Decoder<T> =>
  (v, p = "response") =>
    typeof v === "string" && values.includes(v as T)
      ? (v as T)
      : fail(p, values.join(" | "));
const effect = literal(["ALLOW", "DENY"] as const);
const strings = array(str);
export const ruleContract: Decoder<PolicyRule> = shape({
  id: str,
  name: str,
  decision: literal(["REFUND", "REPLACEMENT"] as const),
  trigger: str,
  when: record,
  effect,
  priority: integer,
  overrides: strings,
  source: shape({ doc_name: str, verbatim_sentence: str }),
  state_updates: optional(nullable(record)),
});
export const compileContract: Decoder<CompileResponse> = shape({
  mode: literal(["live"] as const), model: str, request_id: str,
  provider_requests: count, finish_reason: literal(["stop"] as const),
  total_clauses: count, mapped_clauses: count, unmapped_clauses: array(shape({
    id: str, text: str, doc_name: str, line_number: integer,
  })),
  compiled_rules: array(ruleContract),
  rule_confidence: (v, p) => {
    const input = record(v, p);
    const decoder = shape({rule_id: str, grounded: bool, lint_clean: bool,
      confidence: literal(["HIGH", "MEDIUM", "LOW"] as const), notes: strings});
    return Object.fromEntries(Object.entries(input).map(([k, value]) => [k, decoder(value, `${p}.${k}`)]));
  },
  rejected_rules: array(record), lint_warnings: strings, token_usage: record,
  latency_ms: num, summary: str,
});
const event = shape({
  event_type: str,
  day: integer,
  payload: optional(record),
});
const scenario = shape({
  id: str,
  name: str,
  description: str,
  journey: array(event),
});
export const findingContract: Decoder<Finding> = shape({
  type: str,
  severity: str,
  rule_ids: strings,
  event_indices: array(count),
  trace: str,
  details: optional(nullable(record)),
});
const leaf = shape({ description: str, passed: bool });
const evaluation = shape({
  rule_id: str,
  rule_name: str,
  effect: str,
  priority: integer,
  fired: bool,
  reason: str,
  leaf_evaluations: array(leaf),
});
const trace = shape({
  event_index: count,
  day: integer,
  event_type: str,
  is_decision_event: bool,
  rules_evaluated: strings,
  rules_fired: strings,
  evaluations: array(evaluation),
  active_rules: strings,
  suppressed_rules: strings,
  findings: array(findingContract),
  resolution_type: str,
  outcome: effect,
  explanation: str,
  state_before: record,
  state_after: record,
});
export const simulationContract: Decoder<SimulateResponse> = shape({
  outcomes: array(
    shape({
      event_index: count,
      day: integer,
      event_type: str,
      outcome: effect,
      action_applied: bool,
      resolution_type: str,
      findings: array(findingContract),
    }),
  ),
  final_state: record,
  trace: shape({ event_traces: array(trace) }),
  findings: array(findingContract),
});
export const healthContract: Decoder<HealthResponse> = shape({
  status: str,
  service: str,
});
export const defaultDataContract: Decoder<DefaultData> = (v, p) => {
  const data = shape({
    documents: record,
    rules_v1: array(ruleContract),
    rules_v2: array(ruleContract),
    sample_journeys: array(scenario),
  })(v, p);
  const documents: Record<string, string> = {};
  Object.entries(data.documents).forEach(([key, value]) => {
    documents[key] = str(value, `documents.${key}`);
  });
  return { ...data, documents };
};
const reduced = {
  original_journey: array(event),
  minimal_journey: array(event),
  original_length: count,
  minimal_length: count,
  engine_runs: count,
  reduction_pct: num,
};
export const shrinkContract: Decoder<ShrinkResponse> = shape({
  ...reduced,
  finding: findingContract,
});
const signature: Decoder<[string, string[]]> = (v, p = "signature") =>
  Array.isArray(v) && v.length === 2
    ? [str(v[0], p), strings(v[1], p)]
    : fail(p, "[finding type, rule IDs]");
export const suiteContract: Decoder<SuiteResponse> = shape({
  total_scenarios: count,
  passed_scenarios: count,
  failed_scenarios: count,
  total_findings: count,
  findings_count: count,
  findings: array(
    shape({
      signature,
      finding: findingContract,
      shrink: optional(nullable(shape(reduced))),
    }),
  ),
  summary_table: str,
});
const coverage = shape({
  rule_coverage: num,
  rules_fired: count,
  rules_total: count,
  uncovered_rule_ids: strings,
  event_type_coverage: num,
  transitions_observed: count,
});
const health = shape({
  score: num,
  no_critical_findings: num,
  rule_coverage: num,
  no_gaps: num,
  no_ambiguities: num,
  event_coverage: num,
});
export const diffContract: Decoder<DiffResponse> = shape({
  total_scenarios: count,
  changed_rule_ids: strings,
  outcomes_allow_to_deny: count,
  outcomes_deny_to_allow: count,
  outcome_changes: array(
    shape({
      scenario_id: str,
      scenario_name: str,
      event_index: count,
      day: integer,
      event_type: str,
      outcome_v1: effect,
      outcome_v2: effect,
      resolution_v1: str,
      resolution_v2: str,
      attributed_rule_ids: strings,
      explanation: str,
      needs_review: bool,
    }),
  ),
  finding_deltas: array(
    shape({
      scenario_id: str,
      direction: literal(["INTRODUCED", "RESOLVED"] as const),
      finding: findingContract,
    }),
  ),
  scenarios_needing_review: strings,
  rule_text_diffs: array(
    shape({
      rule_id: str,
      status: literal(["ADDED", "REMOVED", "MODIFIED", "UNCHANGED"] as const),
      v1_summary: optional(nullable(str)),
      v2_summary: optional(nullable(str)),
      changes: strings,
    }),
  ),
  coverage_v1: coverage,
  coverage_v2: coverage,
  health_v1: health,
  health_v2: health,
  summary: str,
});
