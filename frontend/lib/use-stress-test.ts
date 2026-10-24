"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { api, type SuiteResponse } from "./api";
import type { ActivePolicy, Scenario } from "./policy-domain";
import { buildStress, type StressInput } from "./stress";
import { LatestRequest } from "./latest-request";
export function useStressTest(
  active: ActivePolicy | null,
  scenarios: Scenario[],
) {
  const [input, setInput] = useState<StressInput>({
    suite: "boundary",
    limit: 30,
  });
  const prepared = useMemo(
    () => buildStress(input, active, scenarios),
    [input, active, scenarios],
  );
  const key = JSON.stringify({ revision: active?.revision, prepared });
  const gate = useRef(new LatestRequest());
  const [state, setState] = useState<{
    key: string;
    result: SuiteResponse | null;
    loading: boolean;
    error: string | null;
    cancelled?: boolean;
  } | null>(null);
  const visible = state?.key === key ? state : null;
  useEffect(() => {
    const channel = gate.current;
    return () => channel.cancel();
  }, [key]);
  async function run() {
    if (!prepared) return;
    const token = gate.current.begin();
    setState({ key, result: null, loading: true, error: null });
    try {
      const result = await api.runSuite(prepared.request, token.signal);
      if (gate.current.current(token.id))
        setState({ key, result, loading: false, error: null });
    } catch (cause: unknown) {
      if (gate.current.current(token.id))
        setState({
          key,
          result: null,
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : "The suite failed. Retry when the backend is available.",
        });
    }
  }
  return {
    input,
    setInput,
    prepared,
    result: visible?.result ?? null,
    loading: visible?.loading ?? false,
    error: visible?.error ?? null,
    cancelled: visible?.cancelled ?? false,
    run,
    cancel: () => {
      gate.current.cancel();
      setState({
        key,
        result: null,
        loading: false,
        error: null,
        cancelled: true,
      });
    },
  };
}
