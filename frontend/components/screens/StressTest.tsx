"use client";
import Link from "next/link";
import { useWorkspace } from "../workspace/workspace-provider";
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  LoadingState,
  SectionHeader,
} from "../ui/primitives";
import { Counterexample } from "../policy/counterexample";
import { RuleInspector } from "../policy/rule-inspector";
import { findingTitle } from "../../lib/translate";
import { signatureBreakdown } from "../../lib/stress";
export function StressTest() {
  const { active, stress, scenarios } = useWorkspace();
  const { input, setInput, prepared, result, loading, error } = stress;
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Stress testing / deterministic engine"
        title="Put your policy through its paces"
        description="Run a bounded scenario suite, inspect real findings, and replay reduced counterexamples."
        action={<Badge>No AI calls</Badge>}
      />
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-sm font-medium">
              Active policy: {active?.name ?? "None"}
            </h2>
            <p className="mt-2 text-xs text-muted">
              {active?.origin} · revision {active?.revision} ·{" "}
              {active?.rules.length ?? 0} rules · {active?.fingerprint}
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center text-sm text-primary"
            href="/workspace/analyze"
          >
            Select or activate rules →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className="text-xs text-muted">
            Scenario suite
            <select
              aria-label="Stress scenario suite"
              className="policy-input mt-1"
              value={input.suite}
              onChange={(e) =>
                setInput((old) => ({
                  ...old,
                  suite: e.target.value as typeof old.suite,
                }))
              }
            >
              <option value="boundary">Boundary journeys · active rules</option>
              <option value="pairwise">
                Fixed-pattern journeys · backend pairwise
              </option>
              <option value="custom">
                Selected Analyzer demo journeys ({scenarios.length})
              </option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Maximum journeys
            <input
              className="policy-input mt-1"
              type="number"
              min={1}
              max={200}
              step={1}
              value={input.limit}
              onChange={(e) =>
                setInput((old) => ({ ...old, limit: Number(e.target.value) }))
              }
            />
          </label>
        </div>
        <p className="text-xs leading-6 text-muted">
          {prepared?.scope ??
            "Choose a supported suite and an integer cap from 1 to 200; custom suites require selected journeys."}{" "}
          · Default DENY. Limits select the first available cases; this is not
          exhaustive coverage. Fixed patterns do not establish all-pairs
          coverage.
        </p>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
          <span className="text-xs leading-6 text-muted">
            Changing controls clears results. Requests time out after 60
            seconds.
          </span>
          <div className="flex flex-wrap gap-3">
            {loading && (
              <Button variant="secondary" onClick={stress.cancel}>
                Cancel test
              </Button>
            )}
            <Button disabled={!prepared} loading={loading} onClick={stress.run}>
              {error ? "Retry stress test" : "Run stress test"}
            </Button>
          </div>
        </div>
      </Card>
      {loading ? (
        <Card className="p-6">
          <LoadingState label="Running the selected suite and reducing representative findings…" />
        </Card>
      ) : error ? (
        <Alert title="Stress test failed">{error}</Alert>
      ) : result && active ? (
        <section className="space-y-5" aria-labelledby="stress-results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="stress-results" className="text-section-title">
              Stress-test results
            </h2>
            <Link
              href="/workspace/reports"
              className="inline-flex min-h-11 items-center text-sm text-primary"
            >
              View and export report →
            </Link>
          </div>
          <p role="status" className="text-sm text-muted">
            Completed · {result.total_scenarios} journeys executed ·{" "}
            {prepared?.scope}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Journeys executed", result.total_scenarios],
              ["Journeys with findings", result.failed_scenarios],
              ["Finding occurrences", result.total_findings],
              ["Unique signatures", result.findings_count],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-2 font-mono text-2xl">{value}</p>
              </Card>
            ))}
          </div>
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-medium">Signature breakdown</h3>
            <p className="text-xs text-muted">
              Counts below describe unique returned signatures, not occurrence
              frequencies.
            </p>
            {(["type", "severity"] as const).map((field) => (
              <div key={field} className="flex flex-wrap gap-2">
                {signatureBreakdown(result, field).map(([name, count]) => (
                  <Badge key={name}>
                    {name}: {count}
                  </Badge>
                ))}
              </div>
            ))}
            {!result.findings.length && (
              <p className="text-sm text-muted">
                No supported findings in the executed cases. Wider correctness
                remains unverified.
              </p>
            )}
          </Card>
          <Alert tone="warning" title="Finding identity limitation">
            Distinct invariant violations may share a backend signature. Group
            counts and reductions can conflate them; inspect original traces and
            replay evidence.
          </Alert>
          {result.findings.map((item, i) => (
            <Disclosure
              key={JSON.stringify(item.signature)}
              title={`${i + 1}. ${findingTitle(item.finding.type)} · ${item.finding.severity} · ${item.finding.rule_ids.join(", ") || "No rule IDs"}`}
            >
              <div className="space-y-5">
                <p className="whitespace-pre-wrap break-words text-sm leading-7">
                  {item.finding.trace}
                </p>
                <p className="text-xs text-muted">
                  Original finding event indices (zero-based):{" "}
                  {item.finding.event_indices.join(", ") || "Not specified"}.
                  Reduced replay has its own indices.
                </p>
                <Counterexample item={item} active={active} />
                {active.rules
                  .filter((r) => item.finding.rule_ids.includes(r.id))
                  .map((rule) => (
                    <RuleInspector key={rule.id} rule={rule} />
                  ))}
              </div>
            </Disclosure>
          ))}
          <Disclosure title="Backend suite Markdown">
            <pre className="technical-block">{result.summary_table}</pre>
          </Disclosure>
        </section>
      ) : (
        <Card>
          <EmptyState
            title={
              stress.cancelled ? "Test cancelled" : "Choose a suite to begin"
            }
            description="No stress test runs automatically. Results use the exact active rules and selected scenario scope."
          />
        </Card>
      )}
    </div>
  );
}
