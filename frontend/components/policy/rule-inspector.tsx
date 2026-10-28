import type { PolicyRule } from "../../lib/api";
import { eventLabel } from "../../lib/translate";
import { Badge, Card, Disclosure } from "../ui/primitives";

function ConditionText({ node }: { node: unknown }) {
  if (!node || typeof node !== "object") return <span>Invalid condition</span>;
  const value = node as Record<string, unknown>;
  const key = "all" in value ? "all" : "any" in value ? "any" : null;
  if (key && Array.isArray(value[key]))
    return (
      <div>
        <p className="text-xs font-medium text-muted">
          {key === "all"
            ? "All of these conditions"
            : "Any of these conditions"}
          {value[key].length === 0 &&
            ` (always ${key === "all" ? "true" : "false"})`}
        </p>
        <ul className="mt-2 space-y-2 border-l border-border pl-3">
          {value[key].map((child, i) => (
            <li key={i}>
              <ConditionText node={child} />
            </li>
          ))}
        </ul>
      </div>
    );
  const labels: Record<string, string> = {
    EQ: "equals",
    NEQ: "does not equal",
    LT: "is less than",
    LTE: "is at most",
    GT: "is greater than",
    GTE: "is at least",
    IN: "is in",
    NIN: "is not in",
    IS_TRUE: "is true",
    IS_FALSE: "is false",
    IS_NULL: "is not set",
    IS_NOT_NULL: "is set",
  };
  return (
    <p className="break-words text-sm">
      {String(value.field).replace(/_/g, " ")}{" "}
      <span className="text-muted">
        {labels[String(value.op)] ?? String(value.op)}
      </span>
      {!String(value.op).startsWith("IS_") && ` ${JSON.stringify(value.value)}`}
    </p>
  );
}
export function RuleInspector({
  rule,
  manual = false,
  aiCompiled = false,
}: {
  rule: PolicyRule;
  manual?: boolean;
  aiCompiled?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-card-title">{rule.name}</h3>
            <p className="mt-1 break-all font-mono text-[11px] text-muted">
              {rule.id}
            </p>
          </div>
          <Badge tone={rule.effect === "ALLOW" ? "success" : "danger"}>
            {rule.effect === "ALLOW" ? "Allows" : "Denies"}{" "}
            {rule.decision.toLowerCase()}
          </Badge>
        </div>
        <p className="text-xs text-muted">
          When: {eventLabel(rule.trigger)} · Priority {rule.priority}
        </p>
        <ConditionText node={rule.when} />
        {rule.source.verbatim_sentence ? (
          <blockquote className="border-l-2 border-primary/30 pl-3 text-sm leading-7 text-muted">
            “{rule.source.verbatim_sentence}”
          </blockquote>
        ) : (
          <p className="text-xs text-muted">No source quotation provided.</p>
        )}
        <p className="break-words text-xs text-muted">
          {aiCompiled ? "Locally grounded source · " : manual ? "User-supplied source · " : "Fixture source · "}
          {rule.source.doc_name || "Not specified"}
          {manual && " · not independently verified"}
        </p>
        {rule.overrides.length > 0 && (
          <p className="break-all text-xs text-muted">
            Overrides: {rule.overrides.join(", ")}
          </p>
        )}
        {rule.state_updates && Object.keys(rule.state_updates).length > 0 && (
          <p className="break-words text-xs text-muted">
            State updates:{" "}
            {Object.entries(rule.state_updates)
              .map(
                ([key, value]) =>
                  `${key.replace(/_/g, " ")} = ${String(value)}`,
              )
              .join("; ")}
          </p>
        )}
      </div>
      <div className="border-t border-border p-3">
        <Disclosure title="Rule specification">
          <pre className="technical-block">{JSON.stringify(rule, null, 2)}</pre>
        </Disclosure>
      </div>
    </Card>
  );
}
