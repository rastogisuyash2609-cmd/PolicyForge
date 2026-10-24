"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace } from "../workspace/workspace-provider";
import { Card, EmptyState, SectionHeader } from "../ui/primitives";
import {
  createReport,
  reportIsCurrent,
  type AnalysisReport,
} from "../../lib/reports";
import { validateJourney } from "../../lib/policy-domain";

import { ReportView } from "../policy/report-view";
export function ReportsScreen() {
  const {
    active,
    simulation,
    scenarioJson,
    issues,
    scenarios,
    stress,
    comparison,
  } = useWorkspace();
  const [selected, setSelected] = useState("simulation");
  const reports = useMemo(() => {
    if (!active) return [];
    const result: AnalysisReport[] = [];
    const journey = validateJourney(scenarioJson).value;
    if (simulation.result && journey)
      result.push(
        createReport(
          {
            kind: "simulation",
            request: {
              rules: active.rules,
              journey,
              default_decision_outcome: "DENY",
            },
            result: simulation.result,
          },
          active,
          `One Analyzer journey: ${simulation.scenarioName}`,
        ),
      );
    if (issues.suite)
      result.push(
        createReport(
          {
            kind: "suite",
            request: {
              rules: active.rules,
              suite_type: "custom",
              custom_scenarios: scenarios,
              limit: scenarios.length,
              default_decision_outcome: "DENY",
            },
            result: issues.suite,
          },
          active,
          `${scenarios.length} selected demo journeys against active rules`,
        ),
      );
    if (stress.result && stress.prepared)
      result.push(
        createReport(
          {
            kind: "stress",
            request: stress.prepared.request,
            result: stress.result,
          },
          active,
          stress.prepared.scope,
        ),
      );
    if (comparison.result && comparison.prepared)
      result.push(
        createReport(
          {
            kind: "comparison",
            request: comparison.prepared.request,
            result: comparison.result,
          },
          active,
          comparison.prepared.scopeLabel,
          comparison.prepared.identities,
        ),
      );
    return result.filter((report) => reportIsCurrent(report, active));
  }, [
    active,
    scenarioJson,
    simulation.result,
    simulation.scenarioName,
    issues.suite,
    scenarios,
    stress.result,
    stress.prepared,
    comparison.result,
    comparison.prepared,
  ]);
  const report = reports.find((r) => r.kind === selected) ?? reports[0];
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Reports / reproducible evidence"
        title="From findings to a shareable record"
        description="Inspect completed analysis in this workspace session. Export the exact inputs, rule evidence and backend results."
      />
      {report ? (
        <>
          <Card className="p-5">
            <label className="text-xs text-muted">
              Completed analysis
              <select
                className="policy-input mt-1"
                value={report.kind}
                onChange={(e) => setSelected(e.target.value)}
              >
                {reports.map((r) => (
                  <option key={r.kind} value={r.kind}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs leading-6 text-muted">
              Only successful results matching current inputs are available.
              Activating rules clears every report; editing a journey or suite
              scope hides its earlier report. Reports are temporary, with no
              saved history.
            </p>
          </Card>
          <ReportView report={report} />
        </>
      ) : (
        <Card>
          <EmptyState
            title="Run an analysis to create a report"
            description="Completed simulation, Issues, Stress Testing and What-if results appear here. No stale results are carried across policy activations."
          />
          <div className="flex flex-wrap justify-center gap-5 px-5 pb-5">
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary"
              href="/workspace/analyze"
            >
              Analyze a journey →
            </Link>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary"
              href="/workspace/stress-test"
            >
              Run a stress test →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
