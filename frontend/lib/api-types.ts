export interface JourneyEvent {
  event_type: string;
  day: number;
  payload?: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  name: string;
  decision: "REFUND" | "REPLACEMENT";
  trigger: string;
  when: Record<string, unknown>;
  effect: "ALLOW" | "DENY";
  priority: number;
  overrides: string[];
  source: { doc_name: string; verbatim_sentence: string };
  state_updates?: Record<string, unknown> | null;
}

export interface DefaultData {
  documents: Record<string, string>;
  rules_v1: PolicyRule[];
  rules_v2: PolicyRule[];
  sample_journeys: Array<{
    id: string;
    name: string;
    description: string;
    journey: Array<{
      event_type: string;
      day: number;
      payload?: Record<string, unknown>;
    }>;
  }>;
}

export interface CompileResponse {
  mode?: "live";
  model?: string;
  request_id?: string;
  provider_requests?: number;
  finish_reason?: string;
  total_clauses: number;
  mapped_clauses: number;
  unmapped_clauses: Array<{
    id: string;
    text: string;
    doc_name: string;
    line_number: number;
  }>;
  compiled_rules: PolicyRule[];
  rule_confidence: Record<
    string,
    {
      rule_id: string;
      grounded: boolean;
      lint_clean: boolean;
      confidence: "HIGH" | "MEDIUM" | "LOW";
      notes: string[];
    }
  >;
  rejected_rules: Record<string, unknown>[];
  lint_warnings: string[];
  token_usage: Record<string, unknown>;
  latency_ms: number;
  summary: string;
}

export interface Finding {
  type: string;
  severity: string;
  rule_ids: string[];
  event_indices: number[];
  trace: string;
  details?: Record<string, unknown> | null;
}

export interface SimulateResponse {
  outcomes: Array<{
    event_index: number;
    day: number;
    event_type: string;
    outcome: string;
    action_applied: boolean;
    resolution_type: string;
    findings: Finding[];
  }>;
  final_state: Record<string, unknown>;
  trace: {
    event_traces: Array<{
      event_index: number;
      day: number;
      event_type: string;
      is_decision_event: boolean;
      rules_evaluated: string[];
      rules_fired: string[];
      evaluations: Array<{
        rule_id: string;
        rule_name: string;
        effect: string;
        priority: number;
        fired: boolean;
        reason: string;
        leaf_evaluations: Array<{ description: string; passed: boolean }>;
      }>;
      active_rules: string[];
      suppressed_rules: string[];
      findings: Finding[];
      resolution_type: string;
      outcome: string;
      explanation: string;
      state_before: Record<string, unknown>;
      state_after: Record<string, unknown>;
    }>;
  };
  findings: Finding[];
}

export interface SuiteResponse {
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  total_findings: number;
  findings_count: number;
  findings: Array<{
    signature: [string, string[]];
    finding: Finding;
    shrink?: {
      original_journey: Array<{
        event_type: string;
        day: number;
        payload?: Record<string, unknown>;
      }>;
      minimal_journey: Array<{
        event_type: string;
        day: number;
        payload?: Record<string, unknown>;
      }>;
      original_length: number;
      minimal_length: number;
      engine_runs: number;
      reduction_pct: number;
    } | null;
  }>;
  summary_table: string;
}

export interface DiffResponse {
  total_scenarios: number;
  changed_rule_ids: string[];
  outcomes_allow_to_deny: number;
  outcomes_deny_to_allow: number;
  outcome_changes: Array<{
    scenario_id: string;
    scenario_name: string;
    event_index: number;
    day: number;
    event_type: string;
    outcome_v1: string;
    outcome_v2: string;
    resolution_v1: string;
    resolution_v2: string;
    attributed_rule_ids: string[];
    explanation: string;
    needs_review: boolean;
  }>;
  finding_deltas: Array<{
    scenario_id: string;
    direction: "INTRODUCED" | "RESOLVED";
    finding: Finding;
  }>;
  scenarios_needing_review: string[];
  rule_text_diffs: Array<{
    rule_id: string;
    status: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
    v1_summary?: string | null;
    v2_summary?: string | null;
    changes: string[];
  }>;
  coverage_v1: {
    rule_coverage: number;
    rules_fired: number;
    rules_total: number;
    uncovered_rule_ids: string[];
    event_type_coverage: number;
    transitions_observed: number;
  };
  coverage_v2: {
    rule_coverage: number;
    rules_fired: number;
    rules_total: number;
    uncovered_rule_ids: string[];
    event_type_coverage: number;
    transitions_observed: number;
  };
  health_v1: {
    score: number;
    no_critical_findings: number;
    rule_coverage: number;
    no_gaps: number;
    no_ambiguities: number;
    event_coverage: number;
  };
  health_v2: {
    score: number;
    no_critical_findings: number;
    rule_coverage: number;
    no_gaps: number;
    no_ambiguities: number;
    event_coverage: number;
  };
  summary: string;
}

export type Effect = "ALLOW" | "DENY";
export interface ScenarioInput {
  id: string;
  name: string;
  description?: string;
  journey: JourneyEvent[];
  tags?: string[];
}
export interface CompileRequest {
  live?: boolean;
  documents?: Record<string, string>;
  document_text?: string;
  doc_name?: string;
  use_mock?: boolean;
  max_repairs?: number;
}
export interface SimulateRequest {
  rules: PolicyRule[];
  journey: JourneyEvent[];
  default_decision_outcome?: Effect;
}
export interface SuiteRequest {
  rules: PolicyRule[];
  suite_type?: "boundary" | "pairwise" | "custom";
  custom_scenarios?: ScenarioInput[];
  default_decision_outcome?: Effect;
  limit?: number;
}
export interface DiffRequest {
  rules_v1: PolicyRule[];
  rules_v2: PolicyRule[];
  suite_type?: "boundary" | "pairwise" | "custom";
  custom_scenarios?: ScenarioInput[];
  default_decision_outcome?: Effect;
  limit?: number;
}
export interface ShrinkRequest extends SimulateRequest {
  target_finding_type?: string;
  target_rule_ids?: string[];
}
export interface ShrinkResponse {
  original_journey: JourneyEvent[];
  minimal_journey: JourneyEvent[];
  original_length: number;
  minimal_length: number;
  engine_runs: number;
  reduction_pct: number;
  finding: Finding;
}
export interface HealthResponse {
  status: string;
  service: string;
}
