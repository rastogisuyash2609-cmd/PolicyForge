/** Presentation only. Findings and outcomes always come from the Python engine. */
export const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  ORDER_PLACED: { label: "Order placed", icon: "ShoppingCart" },
  ITEM_DELIVERED: { label: "Item delivered", icon: "Package" },
  REFUND_REQUESTED: { label: "Refund requested", icon: "RotateCcw" },
  REFUND_COMPLETED: { label: "Refund completed", icon: "CheckCircle" },
  REPLACEMENT_REQUESTED: { label: "Replacement requested", icon: "RefreshCw" },
  REPLACEMENT_CANCELLED: { label: "Replacement cancelled", icon: "XCircle" },
  REPLACEMENT_DELIVERED: { label: "Replacement delivered", icon: "Package" },
  ITEM_DAMAGED_REPORTED: { label: "Damage reported", icon: "AlertTriangle" },
  RETURN_RECEIVED: { label: "Return received", icon: "PackageCheck" },
  CHARGEBACK_FILED: { label: "Chargeback filed", icon: "CreditCard" },
  CHARGEBACK_RESOLVED: { label: "Chargeback resolved", icon: "CheckCircle" },
  ORDER_CANCELLED: { label: "Order cancelled", icon: "XCircle" },
};
export function eventLabel(raw = ""): string {
  return EVENT_LABELS[raw]?.label ?? raw.replace(/_/g, " ").toLowerCase();
}
export type FindingKind =
  | "CONTRADICTION"
  | "POLICY_GAP"
  | "AMBIGUITY"
  | "INVARIANT_VIOLATION"
  | "DEAD_RULE";
export const FINDING_TITLES: Record<string, string> = {
  CONTRADICTION: "Rules disagree",
  POLICY_GAP: "Missing rule",
  AMBIGUITY: "Unclear priority",
  INVARIANT_VIOLATION: "Business constraint violated",
  DEAD_RULE: "Unreachable rule",
};
export const FINDING_ICONS: Record<string, string> = {
  CONTRADICTION: "AlertTriangle",
  POLICY_GAP: "HelpCircle",
  AMBIGUITY: "Info",
  INVARIANT_VIOLATION: "ShieldAlert",
  DEAD_RULE: "Info",
};
export function findingTitle(raw: string): string {
  return FINDING_TITLES[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}
type FindingSummary = {
  type: string;
  rule_ids?: string[];
  details?: Record<string, unknown>;
  trace?: string;
};
type RuleNames = Record<string, { name: string; effect?: string }>;

export function findingOneLiner(
  finding: FindingSummary,
  rules?: RuleNames,
): string {
  switch (finding.type) {
    case "CONTRADICTION": {
      const names = finding.rule_ids
        ?.map((id) => rules?.[id]?.name)
        .filter(Boolean);
      return names && names.length >= 2
        ? `“${names[0]}” and “${names[1]}” produce conflicting outcomes.`
        : "Opposing rules match the same request without a resolving precedence.";
    }
    case "POLICY_GAP":
      return "No rule covers this request in the tested order state.";
    case "AMBIGUITY":
      return "Opposing rules tie at the same priority. The engine denies the request.";
    case "INVARIANT_VIOLATION":
      return "The tested journey violates a business constraint.";
    default:
      return finding.trace ?? "Review the engine trace for this finding.";
  }
}
export function findingScenarioSentence(
  finding: FindingSummary,
  _rules?: RuleNames,
): string {
  switch (finding.type) {
    case "CONTRADICTION":
      return "The same request matches rules with opposing outcomes. The engine records a contradiction and denies the request so the conflict can be reviewed.";
    case "POLICY_GAP":
      return `No policy rule matches this request in its order state. The configured fallback is ${finding.details?.default_outcome === "ALLOW" ? "approval" : "denial"}, and the engine records a coverage gap for review.`;
    case "AMBIGUITY":
      return "Matching rules with opposing outcomes tie at the same priority. The engine records the ambiguity and applies a deterministic denial.";
    case "INVARIANT_VIOLATION":
      return "This journey reaches a state that violates a registered business constraint. Inspect the trace for the exact condition.";
    default:
      return finding.trace ?? "Review the engine trace for this finding.";
  }
}
export function resolutionBadge(
  resolution: string,
  outcome: string,
): { label: string; kind: "allow" | "deny" | "conflict" | "neutral" } {
  if (resolution === "CONTRADICTION")
    return { label: "Denied · conflicting rules", kind: "conflict" };
  if (resolution === "AMBIGUOUS")
    return { label: "Denied · equal priority", kind: "conflict" };
  if (resolution === "NON_DECISION")
    return { label: "Event processed", kind: "neutral" };
  if (resolution === "DEFAULT_DENY")
    return { label: "Denied by default", kind: "deny" };
  if (resolution === "DEFAULT_ALLOW")
    return { label: "Allowed by default", kind: "allow" };
  if (outcome === "ALLOW") return { label: "Request allowed", kind: "allow" };
  if (outcome === "DENY") return { label: "Request denied", kind: "deny" };
  return { label: "Review outcome", kind: "neutral" };
}
export const STATE_CHIPS = [
  ["item_delivered", "Item delivered"],
  ["replacement_requested", "Replacement requested"],
  ["replacement_cancelled", "Replacement cancelled"],
  ["replacement_active", "Replacement active"],
  ["replacement_completed", "Replacement completed"],
  ["refund_requested", "Refund requested"],
  ["refund_completed", "Refund completed"],
  ["return_received", "Return received"],
  ["item_damaged", "Item damaged"],
  ["is_final_sale", "Final sale item"],
  ["item_opened", "Item opened"],
  ["chargeback_active", "Chargeback active"],
  ["action_denied", "Last action denied"],
  ["order_placed", "Order placed"],
  ["refund_eligibility_restored", "Refund eligibility restored"],
].map(([key, label]) => ({ key, label }));
export function stateChips(state: Record<string, unknown>): string[] {
  const chips = STATE_CHIPS.filter(({ key }) => state[key] === true).map(
    ({ label }) => label,
  );
  if (
    typeof state.customer_tier === "string" &&
    state.customer_tier !== "STANDARD"
  )
    chips.push(`${state.customer_tier} customer`);
  if (
    typeof state.days_since_delivery === "number" &&
    state.item_delivered === true
  )
    chips.push(`Day ${state.days_since_delivery} since delivery`);
  return chips;
}
export function shrinkSummary(shrink: {
  original_length: number;
  minimal_length: number;
  minimal_journey: Array<{ day: number }>;
}): string {
  return shrink.original_length === shrink.minimal_length
    ? "The reducer retained all journey steps; event days may have changed."
    : `Reduced from ${shrink.original_length} to ${shrink.minimal_length} steps while preserving the finding signature.`;
}
