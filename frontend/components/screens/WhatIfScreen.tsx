"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  SectionHeader,
} from "@/components/ui/primitives";
import { PolicyDiff } from "./PolicyDiff";

export function WhatIfScreen() {
  const { comparison, active } = useWorkspace();
  const { input, setInput, prepared, snapshot, result, loading, error } =
    comparison;
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="What-if / offline comparison"
        title="Understand the impact of a change"
        description="Replay the same journeys against two explicit rule sets. Compare deterministic outcomes, findings and observed coverage."
        action={<Badge>No AI calls</Badge>}
      />
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: "baseline" as const, label: "Baseline rule set" },
            { key: "candidate" as const, label: "Comparison rule set" },
          ].map(({ key, label }) => (
            <label key={key} className="text-xs text-muted">
              {label}
              <select
                className="policy-input mt-1"
                aria-label={label}
                value={input[key]}
                onChange={(e) =>
                  setInput((old) => ({ ...old, [key]: e.target.value }))
                }
              >
                <option value="">Choose rules…</option>
                <option value="v1">NovaCart v1 · demo fixture</option>
                <option value="v2">NovaCart v2 · demo fixture</option>
                <option value="snapshot" disabled={!snapshot}>
                  {snapshot
                    ? `${snapshot.name} · ${snapshot.origin} snapshot · rev ${snapshot.revision}`
                    : "Capture an active-policy snapshot first"}
                </option>
              </select>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-bg p-4">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              Active policy: {active?.name ?? "None"}
              {active && ` · rev ${active.revision}`}
            </p>
            <p className="mt-1 text-xs leading-6 text-muted">
              Capture a temporary, explicit copy for comparison. A new capture
              replaces this slot; no version history is stored. Activating
              different rules clears this comparison session.
            </p>
            {snapshot && (
              <p
                role="status"
                className="mt-2 break-words text-xs text-success"
              >
                Captured {snapshot.rules.length} rules · {snapshot.fingerprint}{" "}
                · rev {snapshot.revision}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            size="small"
            disabled={!active}
            onClick={comparison.capture}
          >
            Capture active rules
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className="text-xs text-muted">
            Scenario suite
            <select
              className="policy-input mt-1"
              aria-label="Comparison scenario suite"
              value={input.suite}
              onChange={(e) =>
                setInput((old) => ({
                  ...old,
                  suite: e.target.value as typeof old.suite,
                }))
              }
            >
              <option value="demo">Known demo journeys · shared input</option>
              <option value="current">
                Current Analyzer journey · shared input
              </option>
              <option value="boundary">
                Boundary journeys · baseline generated
              </option>
              <option value="pairwise">
                Fixed-pattern journeys · backend pairwise
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
          {prepared?.scopeLabel ??
            "Select two valid rule sets and a limit from 1 to 200. The current-journey option requires a valid Analyzer journey"}
          . Both engines use the same input sequence and default DENY. The cap
          selects the first available cases.
        </p>
        {input.suite === "boundary" && (
          <Alert tone="warning" title="Baseline-biased boundary coverage">
            The backend generates boundaries from the baseline only, then
            truncates before comparison. Candidate-only boundaries may be
            missed. Use shared demo or edited journeys to control the tested
            input.
          </Alert>
        )}
        {input.suite === "pairwise" && (
          <Alert tone="info" title="Fixed patterns, limited coverage">
            The backend uses a fixed set of journey/flag combinations. The name
            pairwise does not establish all-pairs or exhaustive coverage.
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-xs text-muted">
            Changing inputs clears the displayed comparison. Requests time out
            after 60 seconds.
          </p>
          <div className="flex gap-3">
            {loading && (
              <Button variant="secondary" onClick={comparison.cancel}>
                Cancel comparison
              </Button>
            )}
            <Button
              disabled={!prepared}
              loading={loading}
              onClick={comparison.run}
            >
              {error ? "Retry comparison" : "Compare policies"}
            </Button>
          </div>
        </div>
      </Card>
      {loading ? (
        <Card className="p-6">
          <LoadingState label="Replaying the selected journeys on both rule sets…" />
        </Card>
      ) : error ? (
        <Alert title="Comparison failed">{error}</Alert>
      ) : result && prepared ? (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p role="status" className="text-sm text-muted">
              Completed · {result.total_scenarios} journeys per rule set · cap{" "}
              {input.limit}
            </p>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary"
              href="/workspace/reports"
            >
              View and export report →
            </Link>
          </Card>
          <PolicyDiff
            key={JSON.stringify(prepared)}
            data={result}
            baselineLabel={prepared.baselineLabel}
            candidateLabel={prepared.candidateLabel}
            scopeLabel={prepared.scopeLabel}
          />
        </div>
      ) : (
        <Card>
          <EmptyState
            title={
              comparison.cancelled
                ? "Comparison cancelled"
                : "Choose what to compare"
            }
            description="Select known fixtures or capture the active rules, then run the backend comparison. No analysis is run automatically."
          />
        </Card>
      )}
    </div>
  );
}
