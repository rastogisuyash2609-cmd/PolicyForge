"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { api, type DefaultData } from "@/lib/api";
import { useIssuesAnalysis } from "@/lib/use-issues-analysis";

type WorkspaceState = {
  defaultData: DefaultData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  issues: ReturnType<typeof useIssuesAnalysis>;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [defaultData, setDefaultData] = useState<DefaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<DefaultData> | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    // Reuse the in-flight request during Strict Mode's effect replay.
    const request = pending.current ?? (pending.current = api.getDefaultData());
    request
      .then((data) => {
        if (active) setDefaultData(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "The policy data could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    pending.current = null;
    setAttempt((value) => value + 1);
  }, []);
  const issues = useIssuesAnalysis(
    defaultData,
    pathname === "/workspace/issues",
  );
  return (
    <WorkspaceContext.Provider
      value={{ defaultData, loading, error, retry, issues }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace requires WorkspaceProvider");
  return context;
}
