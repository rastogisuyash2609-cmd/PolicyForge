"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Card, Disclosure } from "../ui/primitives";
import {
  reportJson,
  reportMarkdown,
  reportFilename,
  type AnalysisReport,
} from "../../lib/reports";
import { eventLabel } from "../../lib/translate";
export function ReportView({ report }: { report: AnalysisReport }) {
  const json = useMemo(() => reportJson(report), [report]);
  const markdown = useMemo(() => reportMarkdown(report), [report]);
  const [files, setFiles] = useState<{
    report: AnalysisReport;
    md: string;
    json: string;
  } | null>(null);
  useEffect(() => {
    const md = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const jsonUrl = URL.createObjectURL(
      new Blob([json], { type: "application/json;charset=utf-8" }),
    );
    setFiles({ report, md, json: jsonUrl });
    return () => {
      URL.revokeObjectURL(md);
      URL.revokeObjectURL(jsonUrl);
    };
  }, [report, markdown, json]);
  return (
    <article className="space-y-5" aria-label={report.title}>
      <Card className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="eyebrow">Analysis evidence</p>
            <h2 className="mt-2 text-section-title">{report.title}</h2>
          </div>
          <Badge>Deterministic · offline</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {report.rule_sets.map((set, i) => (
            <div
              key={i}
              className="min-w-0 rounded-lg border border-border bg-bg p-4"
            >
              <h3 className="break-words text-sm font-medium">{set.label}</h3>
              <p className="mt-2 break-words text-xs leading-6 text-muted">
                {set.origin} · {set.rules.length} analyzed rules ·{" "}
                {set.revision === null
                  ? "Repository fixture; no workspace revision"
                  : `revision ${set.revision}`}{" "}
                {set.fingerprint && `· ${set.fingerprint}`}
              </p>
            </div>
          ))}
        </div>
        <p className="break-words text-sm leading-7 text-muted">
          {report.scope}. Default decision: {report.default_decision}. Workspace
          session rev {report.workspace_session.revision}; analyzed rule sets
          are identified above.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(report.metrics).map(([name, value]) => (
            <div key={name} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted">
                {name[0].toUpperCase() + name.slice(1).replace(/_/g, " ")}
              </p>
              <p className="mt-2 font-mono text-xl">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          {(
            [
              {
                extension: "md",
                label: "Download Markdown",
                mime: "text/markdown",
                content: markdown,
              },
              {
                extension: "json",
                label: "Download JSON",
                mime: "application/json",
                content: json,
              },
            ] as const
          ).map((file) => (
            <a
              key={file.extension}
              download={reportFilename(report, file.extension)}
              href={
                files?.report === report
                  ? files[file.extension]
                  : `data:${file.mime};charset=utf-8,${encodeURIComponent(file.content)}`
              }
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-hover"
            >
              {file.label}
            </a>
          ))}
        </div>
        <p className="text-xs text-muted">
          Both exports include exact rule definitions, source quotations,
          request inputs and the full backend response. Nothing is uploaded or
          stored on a server.
        </p>
      </Card>
      {(report.kind === "suite" || report.kind === "stress") &&
        "summary_table" in report.result && (
          <Disclosure title="Readable counterexample evidence">
            <div className="space-y-6">
              {report.result.findings.map((item, i) => (
                <div key={i} className="space-y-3">
                  <h3 className="break-words text-sm font-medium">
                    {item.finding.type} ·{" "}
                    {item.finding.rule_ids.join(", ") || "No rule IDs"}
                  </h3>
                  {item.shrink ? (
                    <>
                      <p className="text-xs text-muted">
                        {item.shrink.original_length} →{" "}
                        {item.shrink.minimal_length} events ·{" "}
                        {item.shrink.reduction_pct.toFixed(1)}% event reduction
                        · {item.shrink.engine_runs} reducer engine runs. A
                        global minimum is not established.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          {
                            label: "Original",
                            events: item.shrink.original_journey,
                          },
                          {
                            label: "Reduced",
                            events: item.shrink.minimal_journey,
                          },
                        ].map(({ label, events }) => (
                          <div key={label} className="min-w-0">
                            <h4 className="mb-2 text-xs font-medium">
                              {label} journey
                            </h4>
                            <ol className="space-y-2">
                              {events.map((event, n) => (
                                <li
                                  key={n}
                                  className="rounded-lg border border-border p-3 text-sm"
                                >
                                  {n + 1}. Day {event.day} ·{" "}
                                  {eventLabel(event.event_type)}
                                  <p className="mt-2 break-words font-mono text-xs text-muted">
                                    Payload:{" "}
                                    {JSON.stringify(event.payload ?? {})}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      No reduction returned for this signature.
                    </p>
                  )}
                </div>
              ))}
              {!report.result.findings.length && (
                <p className="text-sm text-muted">
                  No counterexamples returned for this scope.
                </p>
              )}
            </div>
          </Disclosure>
        )}
      <Card className="p-5">
        <h3 className="text-sm font-medium">Important findings and evidence</h3>
        {report.findings.length ? (
          <ol className="mt-4 space-y-4">
            {report.findings.map((finding, i) => (
              <li key={i} className="rounded-lg border border-border p-4">
                {"finding_deltas" in report.result &&
                  report.result.finding_deltas[i] && (
                    <p className="mb-2 break-words text-xs font-medium text-primary">
                      {report.result.finding_deltas[i].direction} ·{" "}
                      {report.result.finding_deltas[i].scenario_id}
                    </p>
                  )}
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-sm font-medium">
                    {finding.type.replace(/_/g, " ")}
                  </span>
                  <Badge tone="warning">{finding.severity}</Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted">
                  {finding.trace}
                </p>
                <p className="mt-2 break-words text-xs text-muted">
                  Rules: {finding.rule_ids.join(", ") || "No rule IDs"} · Event
                  indices: {finding.event_indices.join(", ") || "Not specified"}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm leading-7 text-muted">
            {report.kind === "comparison"
              ? "No introduced or resolved finding entries returned."
              : "No supported findings returned for this scope."}{" "}
            This does not establish complete correctness.
          </p>
        )}
      </Card>
      <Disclosure title="Supporting rule definitions and source evidence">
        <div className="space-y-4">
          {report.rule_sets.map((set, i) => (
            <div key={i}>
              <h3 className="mb-3 break-words text-sm font-medium">
                {set.label}
              </h3>
              {set.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="mb-3 rounded-lg border border-border p-4"
                >
                  <p className="break-words text-sm">
                    {rule.name} · {rule.id} · {rule.effect} {rule.decision}
                  </p>
                  <blockquote className="mt-2 break-words border-l-2 border-primary pl-3 text-sm text-muted">
                    {rule.source.verbatim_sentence ||
                      "No source quotation supplied."}
                  </blockquote>
                  <p className="mt-2 break-words text-xs text-muted">
                    {rule.source.doc_name}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Disclosure>
      <Disclosure title="Execution details, traces and reduced counterexamples">
        <p className="mb-3 text-xs leading-6 text-muted">
          Original backend evidence. Suite reductions may be null; simulation
          states belong to individual events. Generated suites do not return
          every executed journey, so exports include only returned examples and
          generator parameters.
        </p>
        <pre className="technical-block">
          {JSON.stringify(report.result, null, 2)}
        </pre>
      </Disclosure>
      {report.backend_markdown && (
        <Disclosure title="Backend Markdown summary">
          <pre className="technical-block">{report.backend_markdown}</pre>
        </Disclosure>
      )}
      <Alert tone="info" title="Analysis limitations">
        <ul className="list-disc space-y-2 pl-4">
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Alert>
    </article>
  );
}
