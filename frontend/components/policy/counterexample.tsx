"use client";
import type { ActivePolicy } from "../../lib/policy-domain";
import type { SuiteResponse } from "../../lib/api-types";
import { usePolicySimulation } from "../../lib/use-policy-simulation";
import { retainedEvents } from "../../lib/stress";
import { eventLabel } from "../../lib/translate";
import { Alert, Badge, Button, Disclosure } from "../ui/primitives";
import { SimulationResults } from "./simulation-results";
export function Counterexample({
  item,
  active,
}: {
  item: SuiteResponse["findings"][number];
  active: ActivePolicy;
}) {
  const shrink = item.shrink;
  const simulation = usePolicySimulation(
    active,
    JSON.stringify(shrink?.minimal_journey ?? []),
  );
  if (!shrink)
    return (
      <p className="text-sm text-muted">
        No reduction was returned. The original finding trace remains available.
      </p>
    );
  const retained = retainedEvents(
    shrink.original_journey,
    shrink.minimal_journey,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge>
          {shrink.original_length} → {shrink.minimal_length} events
        </Badge>
        <Badge>{shrink.reduction_pct.toFixed(1)}% event reduction</Badge>
        <Badge>{shrink.engine_runs} reducer engine runs</Badge>
      </div>
      <p className="text-xs leading-6 text-muted">
        Reduced failure-inducing journey, not a guaranteed global minimum.
        Events align in order by type and payload; days can change. Identical
        repeated events may have ambiguous identity.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: "Original journey", journey: shrink.original_journey },
          { title: "Reduced journey", journey: shrink.minimal_journey },
        ].map(({ title, journey }, side) => (
          <div key={title} className="min-w-0">
            <h4 className="mb-3 text-sm font-medium">{title}</h4>
            <ol className="space-y-2">
              {journey.map((event, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border bg-bg p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {i + 1}. Day {event.day} · {eventLabel(event.event_type)}
                    </span>
                    {side === 0 && (
                      <Badge>
                        {retained[i] ? "Retained · day may change" : "Removed"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 break-words font-mono text-xs text-muted">
                    Payload: {JSON.stringify(event.payload ?? {})}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        loading={simulation.loading}
        onClick={() => simulation.run("Reduced counterexample")}
      >
        {simulation.error ? "Retry reduced replay" : "Replay reduced journey"}
      </Button>
      {simulation.error && (
        <Alert title="Replay failed">{simulation.error}</Alert>
      )}
      {simulation.result && (
        <>
          <Alert tone="info" title="Replay verification">
            {simulation.result.findings.some(
              (f) =>
                f.type === item.finding.type &&
                JSON.stringify([...f.rule_ids].sort()) ===
                  JSON.stringify([...item.finding.rule_ids].sort()),
            )
              ? "The backend replay contains the same type/rule-ID signature."
              : "The requested signature was not found in this replay."}{" "}
            Invariant identity collisions limit this check; compare the actual
            traces below.
          </Alert>
          <SimulationResults
            result={simulation.result}
            policyName={`${active.name} · rev ${active.revision}`}
            scenarioName={simulation.scenarioName}
            rules={active.rules}
            journey={shrink.minimal_journey}
          />
        </>
      )}
      <Disclosure title="Reduction evidence JSON">
        <pre className="technical-block">{JSON.stringify(shrink, null, 2)}</pre>
      </Disclosure>
    </div>
  );
}
