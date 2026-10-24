"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { api, type DefaultData, type DiffResponse } from "./api";
import type { ActivePolicy } from "./policy-domain";
import {
  buildComparison,
  capturePolicy,
  emptyComparison,
  type RuleSnapshot,
} from "./comparison";
import { LatestRequest } from "./latest-request";

export function usePolicyComparison(
  data: DefaultData | null,
  active: ActivePolicy | null,
  scenarioJson: string,
  scenarioName: string,
) {
  const [input, setInput] = useState(emptyComparison);
  const [snapshot, setSnapshot] = useState<RuleSnapshot | null>(null);
  const prepared = useMemo(
    () => buildComparison(input, data, snapshot, scenarioJson, scenarioName),
    [input, data, snapshot, scenarioJson, scenarioName],
  );
  const key = JSON.stringify(prepared ?? { input, snapshot });
  const channel = useRef(new LatestRequest());
  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    result: DiffResponse | null;
    error: string | null;
    cancelled: boolean;
  } | null>(null);
  const visible = state?.key === key ? state : null;
  useEffect(() => {
    const gate = channel.current;
    return () => gate.cancel();
  }, [key]);
  async function run() {
    if (!prepared) return;
    const token = channel.current.begin();
    setState({
      key,
      loading: true,
      result: null,
      error: null,
      cancelled: false,
    });
    try {
      const result = await api.diff(prepared.request, token.signal);
      if (channel.current.current(token.id))
        setState({
          key,
          loading: false,
          result,
          error: null,
          cancelled: false,
        });
    } catch (cause: unknown) {
      if (channel.current.current(token.id))
        setState({
          key,
          loading: false,
          result: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Comparison failed. Retry when the backend is available.",
          cancelled: false,
        });
    }
  }
  function cancel() {
    channel.current.cancel();
    setState({
      key,
      loading: false,
      result: null,
      error: null,
      cancelled: true,
    });
  }
  return {
    input,
    setInput,
    snapshot,
    capture: () => {
      if (active) setSnapshot(capturePolicy(active));
    },
    prepared,
    result: visible?.result ?? null,
    loading: visible?.loading ?? false,
    error: visible?.error ?? null,
    cancelled: visible?.cancelled ?? false,
    run,
    cancel,
  };
}
