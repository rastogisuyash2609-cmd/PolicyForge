"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type JourneyEvent,
  type PolicyRule,
  type SimulateResponse,
  type SuiteResponse,
} from "@/lib/api";
import type { ActivePolicy, Scenario } from "./policy-domain";
import { LatestRequest } from "./latest-request";
import { resolutionBadge } from "@/lib/translate";

// Owned by the persistent workspace provider, not by a route page.
export function useIssuesAnalysis(
  policy: ActivePolicy | null,
  scenarios: Scenario[],
  enabled: boolean,
) {
  const scenarioKey = JSON.stringify(scenarios);
  const [suiteRecord, setSuite] = useState<{
    key: string;
    result: SuiteResponse;
  } | null>(null);
  const suite = suiteRecord?.key === scenarioKey ? suiteRecord.result : null;
  const [loading, setLoading] = useState(Boolean(policy));
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [editJourney, setEditJourney] = useState<JourneyEvent[]>([]);
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationVersion = useRef(0);
  const rulesMap = useMemo<Record<string, PolicyRule>>(
    () =>
      Object.fromEntries((policy?.rules ?? []).map((rule) => [rule.id, rule])),
    [policy],
  );

  const suiteChannel = useRef(new LatestRequest());
  const started = useRef(false);
  const runSuite = useCallback(async () => {
    if (!policy || !scenarios.length) {
      setLoading(false);
      setError(
        "Choose at least one journey in Analyze Policy before running the suite.",
      );
      return;
    }
    const token = suiteChannel.current.begin();
    setLoading(true);
    setError(null);
    try {
      const result = await api.runSuite(
        {
          rules: policy.rules,
          suite_type: "custom",
          custom_scenarios: scenarios,
          limit: scenarios.length,
        },
        token.signal,
      );
      if (!suiteChannel.current.current(token.id)) return;
      setSuite({ key: scenarioKey, result });
      setSelected(0);
    } catch (error: unknown) {
      if (!suiteChannel.current.current(token.id)) return;
      setError(
        error instanceof Error
          ? error.message
          : "The scenario suite could not be completed.",
      );
    } finally {
      if (suiteChannel.current.current(token.id)) setLoading(false);
    }
  }, [policy, scenarios, scenarioKey]);
  useEffect(() => {
    suiteChannel.current.cancel();
    started.current = false;
    setSuite(null);
    setError(null);
    setSelected(0);
    setLoading(Boolean(policy));
  }, [scenarioKey, policy]);
  useEffect(() => {
    if (enabled && policy && !started.current) {
      started.current = true;
      void runSuite();
    }
  }, [enabled, policy, runSuite]);

  const findings = suite?.findings ?? [];
  const item = findings[selected];
  const finding = item?.finding;
  const shrink = item?.shrink;
  useEffect(() => {
    simulationVersion.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEditJourney(
      (shrink?.minimal_journey ?? []).map((event) => ({
        ...event,
        payload: event.payload ?? {},
      })),
    );
    setSimResult(null);
    setSimError(null);
    setSimLoading(false);
    setActiveStep(null);
  }, [shrink, selected]);
  useEffect(() => {
    const version = simulationVersion;
    const timer = debounceRef;
    const suiteRequests = suiteChannel.current;
    return () => {
      started.current = false;
      suiteRequests.cancel();
      version.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const simulate = useCallback(
    (journey: JourneyEvent[]) => {
      if (!policy || journey.length === 0) return;
      const version = ++simulationVersion.current;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSimLoading(true);
      setSimError(null);
      setSimResult(null);
      setActiveStep(null);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await api.simulate({
            rules: policy.rules,
            journey,
          });
          if (version === simulationVersion.current) setSimResult(result);
        } catch (error: unknown) {
          if (version === simulationVersion.current)
            setSimError(
              error instanceof Error
                ? error.message
                : "The simulation could not be completed.",
            );
        } finally {
          if (version === simulationVersion.current) setSimLoading(false);
        }
      }, 300);
    },
    [policy],
  );

  function updateDay(index: number, day: number) {
    const journey = editJourney.map((event, i) =>
      i === index ? { ...event, day: Math.max(0, day) } : event,
    );
    setEditJourney(journey);
    simulate(journey);
  }
  function removeStep(index: number) {
    const journey = editJourney.filter((_, i) => i !== index);
    setEditJourney(journey);
    simulate(journey);
  }
  // Match the engine's stable chronological order when indexing its trace.
  const chronologicalJourney = useMemo(
    () => [...editJourney].sort((a, b) => a.day - b.day),
    [editJourney],
  );
  const stepState =
    activeStep === null
      ? null
      : simResult?.trace.event_traces[activeStep]?.state_after;
  const lastDecision = simResult?.outcomes
    .filter((outcome) => outcome.resolution_type !== "NON_DECISION")
    .at(-1);
  const lastOutcome = lastDecision ?? simResult?.outcomes.at(-1);
  const resultBadge = lastOutcome
    ? resolutionBadge(lastOutcome.resolution_type, lastOutcome.outcome)
    : null;
  const relatedRules = (finding?.rule_ids ?? [])
    .map((id) => rulesMap[id])
    .filter((rule): rule is PolicyRule => Boolean(rule));

  return {
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
  };
}
