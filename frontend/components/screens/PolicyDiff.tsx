"use client";
import { useState } from "react";
import type { DiffResponse } from "../../lib/api-types";
import { eventLabel, findingTitle } from "../../lib/translate";
import { Alert, Badge, Card, Disclosure } from "../ui/primitives";

// Refactored from the fixed-version prototype. Every metric below is backend output.
export function PolicyDiff({
  data,
  baselineLabel,
  candidateLabel,
  scopeLabel,
}: {
  data: DiffResponse;
  baselineLabel: string;
  candidateLabel: string;
  scopeLabel: string;
}) {
  const [reviewOnly, setReviewOnly] = useState(false);
  const changes = data.outcome_changes.filter(
    (change) => !reviewOnly || change.needs_review,
  );
  const ruleChanges = data.rule_text_diffs.filter(
    (rule) => rule.status !== "UNCHANGED",
  );
  return (
    <section aria-labelledby="comparison-results" className="space-y-5">
      <div>
        <p className="eyebrow">Actual backend comparison</p>
        <h2 id="comparison-results" className="mt-2 text-section-title">
          Comparison results
        </h2>
        <p className="mt-2 break-words text-sm text-muted">
          Baseline: {baselineLabel}
          <br />
          Comparison: {candidateLabel}
        </p>
        <p className="mt-2 text-xs leading-6 text-muted">
          {scopeLabel}. Executed {data.total_scenarios} journeys on each rule
          set. This is limited scenario evidence, not exhaustive regression
          verification.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Journeys executed", value: data.total_scenarios },
          { label: "ALLOW → DENY events", value: data.outcomes_allow_to_deny },
          { label: "DENY → ALLOW events", value: data.outcomes_deny_to_allow },
          {
            label: "Journeys flagged for review",
            value: data.scenarios_needing_review.length,
          },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <p className="min-h-10 text-xs text-muted">{metric.label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {metric.value}
            </p>
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">
            Outcome / resolution changes · {data.outcome_changes.length} events
          </h3>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={reviewOnly}
              onChange={(e) => setReviewOnly(e.target.checked)}
            />
            Only flagged events
          </label>
        </div>
        <p className="text-xs leading-6 text-muted">
          Counts are changed event outcomes or resolution types, not distinct
          scenarios. Attribution candidates come from differences in fired-rule
          IDs; they are not proof of causality.
        </p>
        {changes.length === 0 ? (
          <p className="rounded-lg border border-border bg-bg p-4 text-sm text-muted">
            {reviewOnly
              ? "No changed events match this filter."
              : "No outcome or resolution changes were observed in the tested journeys."}
          </p>
        ) : (
          <div
            role="region"
            aria-label="Outcome changes table; scroll horizontally"
            tabIndex={0}
            className="max-w-full overflow-x-auto"
          >
            <table className="w-full min-w-[760px] text-left text-xs">
              <caption className="sr-only">
                Actual changed events from baseline to comparison
              </caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  {[
                    "Journey / event",
                    "Baseline",
                    "Comparison",
                    "Backend attribution candidates",
                    "Review / details",
                  ].map((heading) => (
                    <th key={heading} scope="col" className="p-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changes.map((change, i) => (
                  <tr
                    key={`${change.scenario_id}:${change.event_index}:${i}`}
                    className="border-b border-border align-top"
                  >
                    <td className="max-w-64 p-3">
                      <p className="font-medium">{change.scenario_name}</p>
                      <p className="mt-1 text-muted">
                        {eventLabel(change.event_type)} · day {change.day} ·
                        index {change.event_index}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge
                        tone={
                          change.outcome_v1 === "ALLOW" ? "success" : "danger"
                        }
                      >
                        {change.outcome_v1}
                      </Badge>
                      <p className="mt-2 break-all font-mono text-[11px] text-muted">
                        {change.resolution_v1}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge
                        tone={
                          change.outcome_v2 === "ALLOW" ? "success" : "danger"
                        }
                      >
                        {change.outcome_v2}
                      </Badge>
                      <p className="mt-2 break-all font-mono text-[11px] text-muted">
                        {change.resolution_v2}
                      </p>
                    </td>
                    <td className="max-w-52 break-all p-3 font-mono text-[11px] text-muted">
                      {change.attributed_rule_ids.join(", ") ||
                        "Attribution unavailable"}
                    </td>
                    <td className="max-w-72 p-3">
                      <Badge tone={change.needs_review ? "warning" : "neutral"}>
                        {change.needs_review ? "Review flagged" : "Not flagged"}
                      </Badge>
                      <Disclosure title="Backend explanation">
                        <p className="whitespace-pre-wrap break-words text-xs leading-6 text-muted">
                          {change.explanation}
                        </p>
                      </Disclosure>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Rule definition changes</h3>
          <Badge>{data.changed_rule_ids.length} changed IDs</Badge>
        </div>
        <p className="text-xs leading-6 text-muted">
          Backend field comparison reports added, removed and modified rule
          definitions. Source-only quotation changes are not included by this
          backend implementation.
        </p>
        {ruleChanges.length ? (
          ruleChanges.map((rule) => (
            <Disclosure
              key={rule.rule_id}
              title={`${rule.status} · ${rule.rule_id}`}
            >
              <ul className="list-inside list-disc space-y-2 break-words text-xs text-muted">
                {rule.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 text-xs">Baseline definition</p>
                  <pre className="technical-block whitespace-pre-wrap break-words">
                    {rule.v1_summary ?? "Not present"}
                  </pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs">Comparison definition</p>
                  <pre className="technical-block whitespace-pre-wrap break-words">
                    {rule.v2_summary ?? "Not present"}
                  </pre>
                </div>
              </div>
            </Disclosure>
          ))
        ) : (
          <p className="text-sm text-muted">
            No rule definition changes reported.
          </p>
        )}
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium">
          Finding differences · {data.finding_deltas.length} entries
        </h3>
        <Alert tone="info" title="Finding identity limitation">
          Backend grouping uses finding type and sorted rule IDs. Distinct
          invariant failures can share this identity. Review traces before
          interpreting an issue as resolved.
        </Alert>
        {data.finding_deltas.length ? (
          data.finding_deltas.map((delta, i) => (
            <Disclosure
              key={i}
              title={`${delta.direction} · ${findingTitle(delta.finding.type)} · ${delta.scenario_id}`}
            >
              <Badge
                tone={delta.direction === "INTRODUCED" ? "warning" : "success"}
              >
                {delta.direction}
              </Badge>
              <p className="mt-3 text-xs text-muted">
                Severity: {delta.finding.severity} · Event indices:{" "}
                {delta.finding.event_indices.join(", ")}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted">
                {delta.finding.trace}
              </p>
            </Disclosure>
          ))
        ) : (
          <p className="text-sm text-muted">
            No finding-signature changes reported for these journeys.
          </p>
        )}
        {data.scenarios_needing_review.length > 0 && (
          <p className="break-words text-xs text-warning">
            Journeys flagged by backend:{" "}
            {data.scenarios_needing_review.join(", ")}
          </p>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            label: "Baseline",
            coverage: data.coverage_v1,
            health: data.health_v1,
          },
          {
            label: "Comparison",
            coverage: data.coverage_v2,
            health: data.health_v2,
          },
        ].map(({ label, coverage, health }) => (
          <Card key={label} className="space-y-4 p-5">
            <h3 className="text-sm font-medium">
              {label} coverage &amp; heuristic
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">Rules fired at least once</dt>
                <dd>
                  {coverage.rules_fired} / {coverage.rules_total} (
                  {(coverage.rule_coverage * 100).toFixed(1)}%)
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">Event types observed</dt>
                <dd>{(coverage.event_type_coverage * 100).toFixed(1)}%</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">Distinct decision transitions</dt>
                <dd>{coverage.transitions_observed}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">Backend health heuristic</dt>
                <dd>{health.score} / 100</dd>
              </div>
            </dl>
            <p className="text-xs leading-6 text-muted">
              Rule coverage includes fired rules that were subsequently
              suppressed. Health is a suite-dependent backend formula, not
              accuracy, compliance or completeness.
            </p>
            <Disclosure title={`${label} coverage details`}>
              <p className="mb-3 break-all text-xs text-muted">
                Unfired rule IDs:{" "}
                {coverage.uncovered_rule_ids.join(", ") || "None"}
              </p>
              <pre className="technical-block">
                {JSON.stringify({ coverage, health }, null, 2)}
              </pre>
            </Disclosure>
          </Card>
        ))}
      </div>
      <Disclosure title="Backend comparison summary (Markdown)">
        <pre className="technical-block whitespace-pre-wrap break-words">
          {data.summary}
        </pre>
      </Disclosure>
    </section>
  );
}
