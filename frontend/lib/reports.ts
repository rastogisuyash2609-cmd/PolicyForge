import type {
  SimulateRequest,
  SimulateResponse,
  SuiteRequest,
  SuiteResponse,
  DiffRequest,
  DiffResponse,
  Finding,
} from "./api-types";
import {
  capturePolicy,
  type RuleSnapshot,
  type RuleIdentity,
} from "./comparison";
import type { ActivePolicy } from "./policy-domain";
export type ReportInput =
  | { kind: "simulation"; request: SimulateRequest; result: SimulateResponse }
  | { kind: "suite" | "stress"; request: SuiteRequest; result: SuiteResponse }
  | { kind: "comparison"; request: DiffRequest; result: DiffResponse };
export const limitations = [
  "Only the executed journeys and supported deterministic detectors were tested. No policy accuracy or compliance guarantee is established.",
  "Finding identity uses type and rule IDs. Distinct invariant violations can share a signature; reductions and finding deltas may conflate them.",
  "A reduced counterexample is not guaranteed to be globally shortest. Missing reductions are not fabricated.",
  "Generated boundaries and truncation limit coverage. Backend pairwise uses fixed patterns; comparison boundaries come from baseline rules only.",
  "Diff attribution IDs are candidates, not causal proof. Source-only edits are omitted from definition changes. Coverage and health are suite-dependent.",
  "No natural-language extraction or external inference was executed. Reference quotations are rule evidence, not independently verified source validity.",
];
export function createReport(
  input: ReportInput,
  active: ActivePolicy,
  scope: string,
  identities?: [RuleIdentity, RuleIdentity],
) {
  const policy = capturePolicy(active);
  const ruleSets: Array<{
    label: string;
    rules: RuleSnapshot["rules"];
    revision: number | null;
    origin: string;
    fingerprint?: string;
  }> =
    input.kind === "comparison"
      ? [
          {
            ...(identities?.[0] ?? {
              label: "Baseline · identity unavailable",
              origin: "Unspecified",
              revision: null,
            }),
            rules: input.request.rules_v1,
          },
          {
            ...(identities?.[1] ?? {
              label: "Comparison · identity unavailable",
              origin: "Unspecified",
              revision: null,
            }),
            rules: input.request.rules_v2,
          },
        ]
      : [
          {
            label: policy.name,
            rules: input.request.rules,
            revision: policy.revision,
            origin: policy.origin,
            fingerprint: policy.fingerprint,
          },
        ];
  let metrics: Record<string, number>;
  let findings: Finding[];
  let backendMarkdown = "";
  if (input.kind === "simulation") {
    metrics = {
      journeys_executed: 1,
      events_executed: input.result.trace.event_traces.length,
      finding_occurrences: input.result.findings.length,
    };
    findings = input.result.findings;
  } else if (input.kind === "comparison") {
    metrics = {
      journeys_per_rule_set: input.result.total_scenarios,
      changed_events: input.result.outcome_changes.length,
      changed_rule_ids: input.result.changed_rule_ids.length,
      finding_delta_entries: input.result.finding_deltas.length,
    };
    findings = input.result.finding_deltas.map((d) => d.finding);
    backendMarkdown = input.result.summary;
  } else {
    metrics = {
      journeys_executed: input.result.total_scenarios,
      journeys_with_findings: input.result.failed_scenarios,
      finding_occurrences: input.result.total_findings,
      unique_signatures: input.result.findings_count,
    };
    findings = input.result.findings.map((f) => f.finding);
    backendMarkdown = input.result.summary_table;
  }
  return JSON.parse(
    JSON.stringify({
      schema_version: 1,
      title: `PolicyForge ${input.kind} report`,
      workspace_session: {
        name: policy.name,
        revision: policy.revision,
        fingerprint: policy.fingerprint,
        origin: policy.origin,
      },
      rule_sets: ruleSets,
      scope,
      default_decision: "DENY",
      metrics,
      findings,
      backend_markdown: backendMarkdown,
      limitations,
      ...input,
    }),
  ) as AnalysisReport;
}
export type AnalysisReport = {
  schema_version: number;
  title: string;
  kind: ReportInput["kind"];
  workspace_session: {
    name: string;
    revision: number;
    fingerprint: string;
    origin: string;
  };
  rule_sets: Array<{
    label: string;
    rules: RuleSnapshot["rules"];
    revision: number | null;
    origin: string;
    fingerprint?: string;
  }>;
  scope: string;
  default_decision: string;
  metrics: Record<string, number>;
  findings: Finding[];
  backend_markdown: string;
  limitations: string[];
  request: ReportInput["request"];
  result: ReportInput["result"];
};
export function reportIsCurrent(
  report: AnalysisReport,
  active: ActivePolicy | null,
) {
  return (
    !!active &&
    report.workspace_session.revision === active.revision &&
    report.workspace_session.fingerprint === active.fingerprint
  );
}
export function reportJson(report: AnalysisReport) {
  return JSON.stringify(report, null, 2) + "\n";
}
function fence(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const runs = text.match(/`+/g) ?? [];
  const delimiter = "`".repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
  return `${delimiter}json\n${text}\n${delimiter}`;
}
export function reportMarkdown(report: AnalysisReport) {
  return [
    `# ${report.title}`,
    "",
    "## Analyzed rule sets",
    ...report.rule_sets.map(
      (s) =>
        `- ${s.label} | ${s.origin} | ${s.rules.length} rules | revision ${s.revision ?? "repository fixture (no workspace revision)"}${s.fingerprint ? ` | ${s.fingerprint}` : ""}`,
    ),
    "",
    `Scope: ${report.scope}`,
    `Default decision: ${report.default_decision}`,
    "",
    "## Execution summary",
    ...Object.entries(report.metrics).map(
      ([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`,
    ),
    "",
    "## Findings",
    ...report.findings.map(
      (f, i) =>
        `- ${"finding_deltas" in report.result && report.result.finding_deltas[i] ? `${report.result.finding_deltas[i].direction} / ${report.result.finding_deltas[i].scenario_id} / ` : ""}${f.type} / ${f.severity} | rules: ${f.rule_ids.join(", ") || "none"} | event indices: ${f.event_indices.join(", ")}\n\n${f.trace}`,
    ),
    "",
    "## Backend summary",
    report.backend_markdown || "Not provided for this operation.",
    "",
    "## Limitations",
    ...report.limitations.map((l) => `- ${l}`),
    "",
    "## Complete reproducible evidence",
    "Includes exact analyzed rules, source quotations, scenario inputs where supplied, per-event traces or reductions where returned, and the original backend response.",
    fence(report),
    "",
  ].join("\n");
}
export function reportFilename(
  report: AnalysisReport,
  extension: "md" | "json",
) {
  return `policyforge-${report.kind}-rev-${report.workspace_session.revision}.${extension}`;
}
