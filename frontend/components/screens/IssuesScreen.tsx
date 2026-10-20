"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CircleHelp,
  FileText,
  FlaskConical,
  Info,
  Layers,
  Minus,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  eventLabel,
  findingOneLiner,
  findingScenarioSentence,
  findingTitle,
  shrinkSummary,
  stateChips,
} from "@/lib/translate";
import { cn } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  LoadingState,
  SectionHeader,
  Skeleton,
} from "@/components/ui/primitives";

const findingIcons = {
  CONTRADICTION: AlertTriangle,
  POLICY_GAP: CircleHelp,
  AMBIGUITY: Info,
  INVARIANT_VIOLATION: ShieldAlert,
};
function FindingIcon({ type }: { type: string }) {
  const Icon = findingIcons[type as keyof typeof findingIcons] ?? Info;
  return <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />;
}
function Severity({ value }: { value: string }) {
  return (
    <Badge
      tone={
        value === "CRITICAL" || value === "HIGH"
          ? "danger"
          : value === "MEDIUM"
            ? "warning"
            : "neutral"
      }
    >
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </Badge>
  );
}

export function IssuesScreen() {
  const { active, issues } = useWorkspace();
  const {
    rulesMap,
    suite,
    loading,
    error,
    selected,
    setSelected,
    editJourney,
    simResult,
    simLoading,
    simError,
    activeStep,
    setActiveStep,
    runSuite,
    findings,
    item,
    finding,
    shrink,
    simulate,
    updateDay,
    removeStep,
    chronologicalJourney,
    stepState,
    lastOutcome,
    resultBadge,
    relatedRules,
  } = issues;

  if (!active)
    return (
      <Card>
        <EmptyState
          title="No active rules"
          description="Open Analyze Policy to select or create and activate valid rules."
        />
      </Card>
    );
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Deterministic verification"
        title="Policy issues"
        description={`Analyze ${active?.name ?? "the active policy"} · revision ${active?.revision ?? "—"}. Findings come from the selected engine-domain journeys, not exhaustive policy coverage.`}
        action={
          <Button variant="secondary" onClick={runSuite} loading={loading}>
            {!loading && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
            Re-run tests
          </Button>
        }
      />

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 xl:grid-cols-5">
        {[
          {
            label: "Unique signatures",
            value: suite?.findings_count,
            icon: ShieldAlert,
          },
          {
            label: "Journeys executed",
            value: suite?.total_scenarios,
            icon: FlaskConical,
          },
          {
            label: "With findings",
            value: suite?.failed_scenarios,
            icon: ShieldAlert,
          },
          {
            label: "Finding occurrences",
            value: suite?.total_findings,
            icon: Layers,
          },
          {
            label: "Policy rules",
            value: active?.rules.length,
            icon: Layers,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 bg-surface px-3 py-4 sm:px-5"
          >
            <div>
              <p className="min-h-8 text-xs leading-4 text-muted sm:min-h-0">
                {label}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-7 w-8" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {value ?? "—"}
                </p>
              )}
            </div>
            <Icon
              aria-hidden="true"
              className="hidden h-5 w-5 text-muted sm:block"
            />
          </div>
        ))}
      </Card>

      {suite && !loading && !error && (
        <Disclosure title="Backend suite summary (Markdown)">
          <pre className="technical-block whitespace-pre-wrap break-words">
            {suite.summary_table}
          </pre>
        </Disclosure>
      )}
      {loading ? (
        <Card className="space-y-5 p-6">
          <LoadingState label="Running journeys and reducing counterexamples…" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </Card>
      ) : error ? (
        <Alert title="Unable to run the policy tests">{error}</Alert>
      ) : findings.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <CheckCheck aria-hidden="true" className="h-5 w-5 text-success" />
            }
            title="No findings in this suite"
            description={`The engine found no supported issues across ${suite?.total_scenarios ?? 0} tested journeys. Other journeys and unmapped clauses may still need review.`}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[304px_minmax(0,1fr)]">
          <aside
            aria-label="Findings"
            className="min-w-0 space-y-3 lg:sticky lg:top-6"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-medium">Findings</h2>
              <span className="text-xs text-muted">
                {findings.length} to review
              </span>
            </div>
            <ul className="space-y-2">
              {findings.map((entry, index) => (
                <li key={JSON.stringify(entry.signature)}>
                  <button
                    type="button"
                    aria-pressed={selected === index}
                    aria-controls="finding-detail"
                    onClick={() => setSelected(index)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors duration-fast",
                      selected === index
                        ? "border-primary/40 bg-selected shadow-card"
                        : "border-border bg-surface hover:bg-bg",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={
                          entry.finding.type === "POLICY_GAP"
                            ? "text-warning"
                            : "text-danger"
                        }
                      >
                        <FindingIcon type={entry.finding.type} />
                      </span>
                      <Severity value={entry.finding.severity} />
                    </div>
                    <h3 className="mt-3 text-card-title">
                      {findingTitle(entry.finding.type)}
                    </h3>
                    <p
                      className={cn(
                        "mt-1.5 text-sm leading-6",
                        selected === index ? "text-text/80" : "text-muted",
                      )}
                    >
                      {findingOneLiner(entry.finding, rulesMap)}
                    </p>
                    <span
                      className={cn(
                        "mt-4 flex items-center gap-1.5 text-xs font-medium",
                        selected === index
                          ? "text-selected-text"
                          : "text-muted",
                      )}
                    >
                      {selected === index
                        ? "Reviewing finding"
                        : "View finding"}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-1 pt-2 text-xs leading-5 text-muted">
              Findings are verified by Python simulation using the active policy
              and the sample journeys selected in Analyze Policy.
            </p>
          </aside>

          {finding && (
            <div
              id="finding-detail"
              role="region"
              aria-labelledby="finding-title"
              className="min-w-0 space-y-4"
            >
              <Card className="overflow-hidden">
                <div className="border-b border-border p-5 sm:p-6">
                  {finding.type === "INVARIANT_VIOLATION" && (
                    <Alert
                      tone="warning"
                      title="Backend grouping limitation"
                      className="mb-4"
                    >
                      Different invariants can share the same type/rule-ID
                      signature. A reduced journey preserves that signature, not
                      necessarily the original invariant. Review the original
                      trace.
                    </Alert>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="primary">
                      <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                      Engine verified
                    </Badge>
                    <Severity value={finding.severity} />
                  </div>
                  <h2 id="finding-title" className="text-section-title">
                    {findingTitle(finding.type)}
                  </h2>
                  <p className="mt-2 max-w-reading text-sm leading-7 text-muted">
                    {findingScenarioSentence(finding, rulesMap)}
                  </p>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">
                      Reproduction journey
                    </h3>
                    {shrink && (
                      <span className="text-xs text-muted">
                        {editJourney.length}{" "}
                        {editJourney.length === 1 ? "step" : "steps"}
                      </span>
                    )}
                  </div>
                  {shrink ? (
                    <>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {shrinkSummary(shrink)}
                      </p>
                      <div
                        role="region"
                        aria-label="Journey timeline; scroll horizontally"
                        tabIndex={0}
                        className="mt-5 overflow-x-auto rounded-lg pb-2"
                      >
                        <ol className="flex min-w-max items-center gap-2 px-1 py-1">
                          {chronologicalJourney.map((event, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-pressed={activeStep === index}
                                onClick={() =>
                                  setActiveStep(
                                    activeStep === index ? null : index,
                                  )
                                }
                                className={cn(
                                  "min-h-20 w-32 rounded-lg border px-3 py-3 text-left transition-colors duration-fast",
                                  activeStep === index
                                    ? "border-primary bg-selected"
                                    : "border-border bg-bg hover:border-muted/50",
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    activeStep === index
                                      ? "text-text/80"
                                      : "text-muted",
                                  )}
                                >
                                  Day {event.day}
                                </span>
                                <span className="mt-1.5 block text-sm font-medium leading-5">
                                  {eventLabel(event.event_type)}
                                </span>
                              </button>
                              {index < chronologicalJourney.length - 1 && (
                                <ArrowRight
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 text-muted"
                                />
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                      {activeStep !== null && (
                        <div className="mt-3 rounded-lg border border-border bg-bg p-3 text-xs text-muted">
                          {stepState ? (
                            <>
                              <p className="mb-2 font-medium text-text">
                                State after{" "}
                                {eventLabel(
                                  chronologicalJourney[activeStep].event_type,
                                ).toLowerCase()}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {stateChips(stepState).map((chip) => (
                                  <Badge key={chip}>{chip}</Badge>
                                ))}
                              </div>
                            </>
                          ) : (
                            "Run the simulation below to inspect the state at this step."
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      A reduced journey was not returned. The original finding
                      remains available in technical details.
                    </p>
                  )}
                </div>
              </Card>

              {relatedRules.length > 0 && (
                <section aria-labelledby="rules-involved" className="space-y-3">
                  <h3 id="rules-involved" className="px-1 text-sm font-medium">
                    Rules involved
                  </h3>
                  <div className="grid items-start gap-3 sm:grid-cols-2">
                    {relatedRules.map((rule) => (
                      <Card key={rule.id} className="p-5">
                        <Badge
                          tone={rule.effect === "ALLOW" ? "success" : "danger"}
                        >
                          {rule.effect === "ALLOW"
                            ? "Allows the request"
                            : "Denies the request"}
                        </Badge>
                        <h4 className="mt-3 text-card-title">{rule.name}</h4>
                        <blockquote className="mt-2 text-sm leading-7 text-muted">
                          &ldquo;{rule.source.verbatim_sentence}&rdquo;
                        </blockquote>
                        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
                          <FileText
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span>{rule.source.doc_name}</span>
                        </p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {editJourney.length > 0 && (
                <Card className="p-5 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        Try a different journey
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        Change a day or remove a step. The engine recalculates
                        the result.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      loading={simLoading}
                      onClick={() => simulate(editJourney)}
                    >
                      {!simLoading && (
                        <Play aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      Run simulation
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {editJourney.map((event, index) => (
                      <li
                        key={index}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-border bg-bg px-3 py-2"
                      >
                        <span className="min-w-0 text-sm font-medium">
                          {eventLabel(event.event_type)}
                        </span>
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 min-h-9 w-9"
                            aria-label={`Decrease day for ${eventLabel(event.event_type).toLowerCase()}`}
                            disabled={event.day === 0}
                            onClick={() => updateDay(index, event.day - 1)}
                          >
                            <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-14 text-center font-mono text-xs tabular-nums">
                            Day {event.day}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 min-h-9 w-9"
                            aria-label={`Increase day for ${eventLabel(event.event_type).toLowerCase()}`}
                            onClick={() => updateDay(index, event.day + 1)}
                          >
                            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-9 min-h-9 w-9 hover:text-danger"
                            disabled={editJourney.length <= 1}
                            aria-label={`Remove ${eventLabel(event.event_type).toLowerCase()}`}
                            onClick={() => removeStep(index)}
                          >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
                  >
                    <span className="text-sm text-muted">
                      Simulation result
                    </span>
                    {simLoading ? (
                      <span className="text-sm text-muted">Simulating…</span>
                    ) : resultBadge ? (
                      <Badge
                        tone={
                          resultBadge.kind === "allow"
                            ? "success"
                            : resultBadge.kind === "deny"
                              ? "danger"
                              : resultBadge.kind === "conflict"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {resultBadge.label}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted">
                        Ready to simulate
                      </span>
                    )}
                  </div>
                  {simError && (
                    <Alert title="Simulation failed" className="mt-4">
                      {simError}
                    </Alert>
                  )}
                </Card>
              )}

              <Disclosure
                key={`${selected}-${JSON.stringify(item.signature)}`}
                title="Technical details"
              >
                <dl className="mb-4 space-y-3 text-sm">
                  <div>
                    <dt className="mb-1 text-xs text-muted">Finding type</dt>
                    <dd className="break-all font-mono text-xs">
                      {finding.type}
                    </dd>
                  </div>
                  {finding.rule_ids.length > 0 && (
                    <div>
                      <dt className="mb-1 text-xs text-muted">
                        Rule identifiers
                      </dt>
                      <dd className="break-all font-mono text-xs leading-6">
                        {finding.rule_ids.join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mb-2 text-xs font-medium">
                  Suite finding trace · original journey
                </p>
                <pre className="technical-block whitespace-pre-wrap break-words">
                  {finding.trace}
                </pre>
                {simResult && (
                  <>
                    <p className="mb-2 mt-4 text-xs font-medium">
                      Simulation final state
                    </p>
                    <pre className="technical-block max-h-72">
                      {JSON.stringify(simResult.final_state, null, 2)}
                    </pre>
                  </>
                )}
              </Disclosure>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
