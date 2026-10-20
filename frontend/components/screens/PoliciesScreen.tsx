"use client";
import { ArrowDownLeft, ArrowUpRight, BookOpen, FileText } from "lucide-react";
import type { DefaultData } from "@/lib/api";
import {
  Badge,
  Card,
  Disclosure,
  EmptyState,
  SectionHeader,
} from "@/components/ui/primitives";

export function PoliciesScreen({
  defaultData,
}: {
  defaultData: DefaultData | null;
}) {
  const rules = defaultData?.rules_v1 ?? [];
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Policy library"
        title="The rules behind each decision"
        description={`${rules.length} rules in the NovaCart v1 demonstration. Each rule retains its source quotation for review.`}
      />
      <Card className="flex items-start gap-3 bg-sidebar p-4 text-sm">
        <BookOpen
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        />
        <p className="text-muted">
          These are the existing, precompiled demonstration rules. Source
          quotations provide context; they do not establish complete coverage of
          every policy clause.
        </p>
      </Card>
      {rules.length === 0 ? (
        <Card>
          <EmptyState
            title="No policy rules loaded"
            description="Rules will appear here when the demonstration policy data is available."
          />
        </Card>
      ) : (
        ["REFUND", "REPLACEMENT"].map((decision) => {
          const group = rules.filter((rule) => rule.decision === decision);
          return (
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
                  <Card key={rule.id} className="overflow-hidden">
                    <div className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h3 className="text-card-title">{rule.name}</h3>
                        <Badge
                          className="shrink-0"
                          tone={rule.effect === "ALLOW" ? "success" : "danger"}
                        >
                          {rule.effect === "ALLOW" ? (
                            <ArrowUpRight
                              aria-hidden="true"
                              className="h-3 w-3"
                            />
                          ) : (
                            <ArrowDownLeft
                              aria-hidden="true"
                              className="h-3 w-3"
                            />
                          )}
                          {rule.effect === "ALLOW" ? "Allows" : "Denies"}
                        </Badge>
                      </div>
                      {rule.source?.verbatim_sentence && (
                        <blockquote className="border-l-2 border-primary/30 pl-3 text-sm leading-7 text-muted">
                          &ldquo;{rule.source.verbatim_sentence}&rdquo;
                        </blockquote>
                      )}
                      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
                        <FileText
                          aria-hidden="true"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        />
                        <span>
                          {rule.source?.doc_name ?? "Source not specified"}
                        </span>
                      </p>
                    </div>
                    <div className="border-t border-border p-3">
                      <Disclosure title="Rule specification">
                        <dl className="mb-3 grid gap-2 text-sm">
                          <div>
                            <dt className="inline text-muted">Rule ID: </dt>
                            <dd className="inline break-all font-mono text-xs">
                              {rule.id}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-muted">Priority: </dt>
                            <dd className="inline">{rule.priority}</dd>
                          </div>
                        </dl>
                        <pre className="technical-block">
                          {JSON.stringify(rule.when, null, 2)}
                        </pre>
                      </Disclosure>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
