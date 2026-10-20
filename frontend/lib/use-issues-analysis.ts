"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DefaultData,
  type JourneyEvent,
  type PolicyRule,
  type SimulateResponse,
  type SuiteResponse,
} from "@/lib/api";
import { resolutionBadge } from "@/lib/translate";

// Owned by the persistent workspace provider, not by a route page.
export function useIssuesAnalysis(
  defaultData: DefaultData | null,
  enabled: boolean,
) {
  const [suite, setSuite] = useState<SuiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
      Object.fromEntries(
        (defaultData?.rules_v1 ?? []).map((rule) => [rule.id, rule]),
      ),
    [defaultData],
  );

  const runSuite = useCallback(async () => {
    if (!defaultData) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.runSuite({
        rules: defaultData.rules_v1,
        suite_type: "custom",
        custom_scenarios: defaultData.sample_journeys,
      });
      setSuite(result);
      setSelected(0);
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "The scenario suite could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }, [defaultData]);
  const started = useRef(false);
  useEffect(() => {
    if (enabled && defaultData && !started.current) {
      started.current = true;
      void runSuite();
    }
  }, [enabled, defaultData, runSuite]);

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
    return () => {
      version.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const simulate = useCallback(
    (journey: JourneyEvent[]) => {
      if (!defaultData || journey.length === 0) return;
      const version = ++simulationVersion.current;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSimLoading(true);
      setSimError(null);
      setSimResult(null);
      setActiveStep(null);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await api.simulate({
            rules: defaultData.rules_v1,
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
    [defaultData],
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
