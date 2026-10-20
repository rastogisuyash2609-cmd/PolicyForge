"use client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { EVENTS, validateJourney } from "@/lib/policy-domain";
import { eventLabel } from "@/lib/translate";
import type { JourneyEvent } from "@/lib/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclosure,
} from "@/components/ui/primitives";
import { SimulationResults } from "./simulation-results";

export function ScenarioWorkbench() {
  const {
    active,
    defaultData,
    scenarioJson,
    setScenarioJson,
    scenarioName,
    setScenarioName,
    simulation,
    selectedScenarioIds,
    setSelectedScenarioIds,
  } = useWorkspace();
  const validation = validateJourney(scenarioJson);
  function replace(events: JourneyEvent[]) {
    setScenarioJson(JSON.stringify(events, null, 2));
  }
  return (
    <section
      id="scenario"
      aria-labelledby="scenario-heading"
      className="space-y-5 scroll-mt-6"
    >
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">02 / Test a journey</p>
            <h2 id="scenario-heading" className="mt-2 text-section-title">
              Scenario &amp; simulation
            </h2>
          </div>
          <Badge>Python engine · no AI calls</Badge>
        </div>
        <p className="mt-3 text-sm leading-7 text-muted">
          Test supported refund and replacement behavior. Sample journeys use
          NovaCart order events and can expose unruled decisions in a custom
          policy; they are not universal policy coverage.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Load example scenario
            <select
              className="policy-input mt-1"
              value=""
              disabled={!defaultData}
              onChange={(e) => {
                const scenario = defaultData?.sample_journeys.find(
                  (s) => s.id === e.target.value,
                );
                if (scenario) {
                  replace(scenario.journey);
                  setScenarioName(scenario.name);
                }
              }}
            >
              <option value="">Select a known journey…</option>
              {defaultData?.sample_journeys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Scenario name
            <input
              className="policy-input mt-1"
              maxLength={120}
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
            />
          </label>
        </div>
        {validation.value && (
          <ol className="mt-5 space-y-3">
            {validation.value.map((event, index, events) => (
              <li
                key={index}
                className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg p-3 sm:grid-cols-[minmax(0,1fr)_100px_auto]"
              >
                <label className="min-w-0 text-xs text-muted">
                  Event {index + 1}
                  <select
                    aria-label={`Event ${index + 1} type`}
                    className="policy-input mt-1"
                    value={event.event_type}
                    onChange={(e) =>
                      replace(
                        events.map((old, i) =>
                          i === index
                            ? { ...old, event_type: e.target.value }
                            : old,
                        ),
                      )
                    }
                  >
                    {EVENTS.map((type) => (
                      <option key={type} value={type}>
                        {eventLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Day
                  <input
                    aria-label={`Event ${index + 1} day`}
                    className="policy-input mt-1"
                    type="number"
                    min={0}
                    step={1}
                    value={event.day}
                    onChange={(e) =>
                      replace(
                        events.map((old, i) =>
                          i === index
                            ? {
                                ...old,
                                day: Math.max(
                                  0,
                                  Math.trunc(Number(e.target.value)),
                                ),
                              }
                            : old,
                        ),
                      )
                    }
                  />
                </label>
                <Button
                  className="self-end"
                  variant="ghost"
                  size="small"
                  disabled={events.length <= 1}
                  aria-label={`Remove event ${index + 1}`}
                  onClick={() => replace(events.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
                {Object.keys(event.payload ?? {}).length > 0 && (
                  <p className="break-words text-xs text-muted sm:col-span-3">
                    Payload: {JSON.stringify(event.payload)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="small"
            disabled={!validation.value || validation.value.length >= 50}
            onClick={() =>
              validation.value &&
              replace([
                ...validation.value,
                {
                  event_type: "REFUND_REQUESTED",
                  day: validation.value.at(-1)?.day ?? 0,
                  payload: {},
                },
              ])
            }
          >
            Add event
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              replace([
                { event_type: "ITEM_DELIVERED", day: 0, payload: {} },
                { event_type: "REFUND_REQUESTED", day: 15, payload: {} },
              ]);
              setScenarioName("Refund after delivery");
            }}
          >
            Reset journey
          </Button>
        </div>
        <div className="mt-5">
          <Disclosure title="Edit event JSON / payload attributes">
            <label className="block text-xs text-muted">
              Scenario JSON
              <textarea
                spellCheck={false}
                rows={12}
                className="policy-input mt-2 font-mono text-xs"
                value={scenarioJson}
                onChange={(e) => setScenarioJson(e.target.value)}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-muted">
              Payload keys must be supported StateField names with typed values,
              for example customer_tier: &quot;VIP&quot;, is_final_sale: true,
              or amount_paid: 100. JSON event order breaks ties on the same day.
            </p>
          </Disclosure>
        </div>
        {validation.errors.length > 0 && (
          <Alert title="Fix the scenario before running" className="mt-4">
            <ul className="list-inside list-disc">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
        {validation.warnings.map((warning) => (
          <p key={warning} className="mt-3 text-xs leading-5 text-warning">
            {warning}
          </p>
        ))}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="max-w-reading break-words text-xs text-muted">
            {active
              ? `Runs active policy: ${active.name} · revision ${active.revision}`
              : "Activate valid rules before running a simulation."}{" "}
            Editing a journey clears its previous result.
          </p>
          <Button
            disabled={!active || !validation.value || !scenarioName.trim()}
            loading={simulation.loading}
            onClick={() => simulation.run(scenarioName)}
          >
            Run Simulation
          </Button>
        </div>
        <div
          role="status"
          aria-live="polite"
          className="mt-3 text-xs text-muted"
        >
          {simulation.loading
            ? "Running the deterministic engine…"
            : simulation.result
              ? "Simulation completed for the active policy and current journey."
              : "Ready when valid rules and a journey are available."}
        </div>
        {simulation.error && (
          <Alert className="mt-4" title="Simulation failed">
            {simulation.error}
            <Button
              className="mt-3"
              variant="secondary"
              size="small"
              onClick={() => simulation.run(scenarioName)}
            >
              Retry simulation
            </Button>
          </Alert>
        )}
        <Disclosure title="Choose journeys for the Issues suite">
          <fieldset className="space-y-2">
            <legend className="mb-3 text-xs text-muted">
              At least one journey must be selected. Changing the selection
              clears previous suite results.
            </legend>
            {defaultData?.sample_journeys.map((scenario) => (
              <label
                key={scenario.id}
                className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm"
              >
                <input
                  className="mt-1 h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={selectedScenarioIds.includes(scenario.id)}
                  disabled={
                    selectedScenarioIds.length === 1 &&
                    selectedScenarioIds.includes(scenario.id)
                  }
                  onChange={(e) =>
                    setSelectedScenarioIds((old) =>
                      e.target.checked
                        ? [...old, scenario.id]
                        : old.filter((id) => id !== scenario.id),
                    )
                  }
                />
                <span>{scenario.name}</span>
              </label>
            ))}
          </fieldset>
        </Disclosure>
      </Card>
      {simulation.result && active && (
        <SimulationResults
          key={`${active.revision}:${scenarioJson}`}
          result={simulation.result}
          policyName={active.name}
          scenarioName={simulation.scenarioName}
          rules={active.rules}
        />
      )}
    </section>
  );
}
