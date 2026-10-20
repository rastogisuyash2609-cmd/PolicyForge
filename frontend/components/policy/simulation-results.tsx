"use client";
import { useState } from "react";
import type { PolicyRule, SimulateResponse } from "../../lib/api";
import { eventLabel, findingTitle, resolutionBadge } from "../../lib/translate";
import { Badge, Card, Disclosure } from "../ui/primitives";

export function SimulationResults({
  result,
  policyName,
  scenarioName,
  rules,
}: {
  result: SimulateResponse;
  policyName: string;
  scenarioName: string;
  rules: PolicyRule[];
}) {
  const [step, setStep] = useState(0);
  const trace = result.trace.event_traces[step];
  const names = (ids: string[]) =>
    ids.map((id) => rules.find((r) => r.id === id)?.name ?? id).join(", ") ||
    "None";
  return (
    <section aria-labelledby="simulation-heading" className="space-y-5">
      <div>
        <p className="eyebrow">Deterministic execution</p>
        <h2 id="simulation-heading" className="mt-2 text-section-title">
          Simulation results
        </h2>
        <p className="mt-1 break-words text-sm text-muted">
          {policyName} · {scenarioName}
        </p>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-medium">Decision outcomes</h3>
        <ul className="mt-4 space-y-3">
          {result.outcomes
            .filter((o) => o.resolution_type !== "NON_DECISION")
            .map((outcome) => {
              const badge = resolutionBadge(
                outcome.resolution_type,
                outcome.outcome,
              );
              return (
                <li
                  key={outcome.event_index}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3"
                >
                  <span className="text-sm">
                    Day {outcome.day} · {eventLabel(outcome.event_type)}
                  </span>
                  <Badge
                    tone={outcome.outcome === "ALLOW" ? "success" : "danger"}
                  >
                    {badge.label}
                  </Badge>
                </li>
              );
            })}
        </ul>
        {!result.outcomes.some((o) => o.resolution_type !== "NON_DECISION") && (
          <p className="mt-3 text-sm text-muted">
            No decision request in this journey. Event traces and invariant
            checks are shown below.
          </p>
        )}
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Findings in this journey</h3>
          <Badge>{result.findings.length} findings</Badge>
        </div>
        {result.findings.length ? (
          <ul className="mt-4 space-y-3">
            {result.findings.map((finding, index) => (
              <li key={index} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">
                    {findingTitle(finding.type)}
                  </h4>
                  <Badge
                    tone={
                      finding.severity === "HIGH" ||
                      finding.severity === "CRITICAL"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {finding.severity}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                  {finding.trace}
                </p>
                <p className="mt-2 break-words text-xs text-muted">
                  Rules: {names(finding.rule_ids)} · Event indices (zero-based):{" "}
                  {finding.event_indices.join(", ") || "Not specified"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            No supported findings in this journey. This does not establish
            complete policy correctness or coverage.
          </p>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-medium">Execution timeline</h3>
        <div
          role="region"
          aria-label="Execution timeline; scroll horizontally"
          tabIndex={0}
          className="max-w-full overflow-x-auto pb-3"
        >
          <ol className="flex min-w-max gap-2">
            {result.trace.event_traces.map((entry, index) => (
              <li key={index}>
                <button
                  type="button"
                  aria-pressed={step === index}
                  aria-controls="event-inspection"
                  onClick={() => setStep(index)}
                  className={`min-h-11 rounded-lg border px-4 py-3 text-left text-xs ${step === index ? "border-primary bg-selected text-selected-text" : "border-border bg-bg"}`}
                >
                  <span className="font-mono">
                    {index + 1} · Day {entry.day}
                  </span>
                  <span className="mt-1 block font-medium">
                    {eventLabel(entry.event_type)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {trace && (
          <div
            id="event-inspection"
            className="mt-4 space-y-4 border-t border-border pt-4"
          >
            <p className="text-sm font-medium">
              Step {step + 1}: {eventLabel(trace.event_type)}
            </p>
            <p className="text-sm leading-7 text-muted">{trace.explanation}</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Rules fired</dt>
                <dd className="break-words">{names(trace.rules_fired)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  Active rules after conflict resolution
                </dt>
                <dd className="break-words">
                  {names(trace.active_rules ?? [])}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Suppressed rules</dt>
                <dd className="break-words">
                  {names(trace.suppressed_rules ?? [])}
                </dd>
              </div>
            </dl>
            <div>
              <h4 className="text-xs font-medium">
                State changes at this event
              </h4>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {Object.entries(trace.state_after)
                  .filter(
                    ([key, value]) =>
                      JSON.stringify(value) !==
                      JSON.stringify(trace.state_before[key]),
                  )
                  .map(([key, value]) => (
                    <li key={key} className="break-words">
                      {key.replace(/_/g, " ")}:{" "}
                      <span className="font-mono">
                        {JSON.stringify(trace.state_before[key])} →{" "}
                        {JSON.stringify(value)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
            {trace.evaluations.map((evaluation) => (
              <Disclosure
                key={evaluation.rule_id}
                title={`${evaluation.rule_name} · ${evaluation.fired ? "matched" : "not matched"}`}
              >
                <p className="mb-2 text-xs text-muted">{evaluation.reason}</p>
                <ul className="space-y-1 text-xs">
                  {evaluation.leaf_evaluations.map((leaf, i) => (
                    <li key={i} className="break-words">
                      {leaf.passed ? "Pass" : "Fail"}: {leaf.description}
                    </li>
                  ))}
                </ul>
                {rules.find((r) => r.id === evaluation.rule_id)?.source
                  .verbatim_sentence && (
                  <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm text-muted">
                    {
                      rules.find((r) => r.id === evaluation.rule_id)?.source
                        .verbatim_sentence
                    }
                  </blockquote>
                )}
              </Disclosure>
            ))}
            <Disclosure title="State before / after this event">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 text-xs">Before event</p>
                  <pre className="technical-block">
                    {JSON.stringify(trace.state_before, null, 2)}
                  </pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs">After event</p>
                  <pre className="technical-block">
                    {JSON.stringify(trace.state_after, null, 2)}
                  </pre>
                </div>
              </div>
            </Disclosure>
          </div>
        )}
      </Card>
      <Disclosure title="Complete simulation JSON / final state">
        <p className="mb-3 text-xs text-muted">
          Final state is after the entire journey; step inspection above uses
          event-local state.
        </p>
        <pre className="technical-block">{JSON.stringify(result, null, 2)}</pre>
      </Disclosure>
    </section>
  );
}
