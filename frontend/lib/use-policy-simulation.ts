"use client";
import { useEffect, useRef, useState } from "react";
import { api, type SimulateResponse } from "./api";
import type { ActivePolicy } from "./policy-domain";
import { validateJourney } from "./policy-domain";
import { LatestRequest } from "./latest-request";

export function usePolicySimulation(
  policy: ActivePolicy | null,
  scenarioJson: string,
) {
  const gate = useRef(new LatestRequest());
  const [request, setRequest] = useState<{
    input: string;
    name: string;
    loading: boolean;
    result: SimulateResponse | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const channel = gate.current;
    return () => channel.cancel();
  }, [scenarioJson]);
  const visible = request?.input === scenarioJson ? request : null;
  async function run(name: string) {
    const journey = validateJourney(scenarioJson);
    if (!policy || !journey.value) return;
    const token = gate.current.begin();
    setRequest({
      input: scenarioJson,
      name,
      loading: true,
      result: null,
      error: null,
    });
    try {
      const result = await api.simulate(
        { rules: policy.rules, journey: journey.value },
        token.signal,
      );
      if (gate.current.current(token.id))
        setRequest({
          input: scenarioJson,
          name,
          loading: false,
          result,
          error: null,
        });
    } catch (cause: unknown) {
      if (gate.current.current(token.id))
        setRequest({
          input: scenarioJson,
          name,
          loading: false,
          result: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Simulation failed. Retry when the API is available.",
        });
    }
  }
  return {
    result: visible?.result ?? null,
    loading: visible?.loading ?? false,
    error: visible?.error ?? null,
    scenarioName: visible?.name ?? "",
    run,
  };
}
