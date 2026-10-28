"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  Badge,
  Card,
  Disclosure,
  EmptyState,
  SectionHeader,
} from "@/components/ui/primitives";
import { RuleInspector } from "@/components/policy/rule-inspector";

export function PoliciesScreen() {
  const { active } = useWorkspace();
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Active policy library"
        title="The rules behind each decision"
        description={
          active
            ? `${active.rules.length} rules in ${active.name}. These are the exact active rules used by simulation and Issues.`
            : "Activate valid rules in Analyze Policy to begin."
        }
        action={
          <Link
            href="/workspace/analyze"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Analyze Policy
          </Link>
        }
      />
      {!active ? (
        <Card>
          <EmptyState
            title="No active rules"
            description="Select a demo or create supported structured rules in Analyze Policy."
          />
        </Card>
      ) : (
        <>
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-words text-sm font-medium">{active.name}</p>
              <Badge tone={active.origin === "manual" ? "info" : "primary"}>
                {active.origin === "ai" ? "AI compiled" : active.origin === "manual" ? "Manual rules" : "Demo Policy"}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted">
              Revision {active.revision} · {active.fingerprint}
            </p>
            <p className="text-sm leading-7 text-muted">
              {active.origin === "ai" ? "AI-extracted rules passed local schema and source-grounding checks. Human review remains necessary; validation does not establish policy completeness."
                : active.origin === "manual"
                ? "Rules and source metadata were supplied manually. Source quotations are not independently verified or AI-grounded."
                : "Predefined repository fixtures, not freshly extracted rules. Source quotations do not establish exhaustive policy coverage."}
            </p>
            {active.warnings.length > 0 && (
              <Disclosure title="Active policy warnings">
                <ul className="list-inside list-disc space-y-2 text-xs text-warning">
                  {active.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
            {active.documents && (
              <Disclosure title="Reference policy text">
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-muted">
                  {active.documents}
                </pre>
              </Disclosure>
            )}
          </Card>
          {["REFUND", "REPLACEMENT"].map((decision) => {
            const group = active.rules.filter((r) => r.decision === decision);
            return (
              group.length > 0 && (
                <section
                  key={decision}
                  aria-labelledby={`rules-${decision}`}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <h2 id={`rules-${decision}`} className="text-section-title">
                      {decision === "REFUND"
                        ? "Refund policy"
                        : "Replacement policy"}
                    </h2>
                    <Badge>{group.length} rules</Badge>
                  </div>
                  <div className="grid items-start gap-4 lg:grid-cols-2">
                    {group.map((rule) => (
                      <RuleInspector
                        key={rule.id}
                        rule={rule}
                        manual={active.origin === "manual"}
                        aiCompiled={active.origin === "ai"}
                      />
                    ))}
                  </div>
                </section>
              )
            );
          })}
        </>
      )}
    </div>
  );
}
