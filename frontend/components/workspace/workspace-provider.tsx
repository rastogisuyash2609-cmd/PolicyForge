"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { api, type DefaultData } from "@/lib/api";
import { useIssuesAnalysis } from "@/lib/use-issues-analysis";
import { usePolicyComparison } from "@/lib/use-policy-comparison";
import { usePolicySimulation } from "@/lib/use-policy-simulation";
import {
  activateDraft,
  demoDraft,
  emptyDraft,
  type ActivePolicy,
  type PolicyDraft,
  type Scenario,
} from "@/lib/policy-domain";

type WorkspaceState = {
  defaultData: DefaultData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  active: ActivePolicy | null;
  draft: PolicyDraft;
  setDraft: React.Dispatch<React.SetStateAction<PolicyDraft>>;
  activate: () => boolean;
  activationErrors: string[];
  scenarioJson: string;
  setScenarioJson: React.Dispatch<React.SetStateAction<string>>;
  scenarioName: string;
  setScenarioName: React.Dispatch<React.SetStateAction<string>>;
  selectedScenarioIds: string[];
  setSelectedScenarioIds: React.Dispatch<React.SetStateAction<string[]>>;
  editorIndex: number;
  setEditorIndex: React.Dispatch<React.SetStateAction<number>>;
  issues: ReturnType<typeof useIssuesAnalysis>;
  simulation: ReturnType<typeof usePolicySimulation>;
  comparison: ReturnType<typeof usePolicyComparison>;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [defaultData, setDefaultData] = useState<DefaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<DefaultData> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<ActivePolicy | null>(null);
  const [draft, setDraft] = useState<PolicyDraft>(emptyDraft);
  const revision = useRef(0);
  const [activationErrors, setActivationErrors] = useState<string[]>([]);
  const [scenarioJson, setScenarioJson] = useState(
    '[{"event_type":"ITEM_DELIVERED","day":0,"payload":{}},{"event_type":"REFUND_REQUESTED","day":15,"payload":{}}]',
  );
  const [scenarioName, setScenarioName] = useState("Refund after delivery");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [editorIndex, setEditorIndex] = useState(0);
  useEffect(() => {
    if (!defaultData) return;
    const initial = activateDraft(demoDraft(defaultData, "v1"), 1).value;
    setActive((previous) => previous ?? initial);
    revision.current = Math.max(revision.current, 1);
    setSelectedScenarioIds((previous) =>
      previous.length ? previous : defaultData.sample_journeys.map((s) => s.id),
    );
  }, [defaultData]);
  function activate() {
    const result = activateDraft(draft, revision.current + 1);
    setActivationErrors(result.errors);
    if (!result.value) return false;
    revision.current++;
    setActive(result.value);
    return true;
  }
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
  const scenarios: Scenario[] = useMemo(
    () =>
      (defaultData?.sample_journeys ?? []).filter((scenario) =>
        selectedScenarioIds.includes(scenario.id),
      ),
    [defaultData, selectedScenarioIds],
  );
  const scope = String(active?.revision ?? 0);
  return (
    <AnalysisSession
      key={scope}
      workspace={{
        defaultData,
        loading,
        error,
        retry,
        active,
        draft,
        setDraft,
        activate,
        activationErrors,
        scenarioJson,
        setScenarioJson,
        scenarioName,
        setScenarioName,
        selectedScenarioIds,
        setSelectedScenarioIds,
        editorIndex,
        setEditorIndex,
      }}
      scenarios={scenarios}
    >
      {children}
    </AnalysisSession>
  );
}

function AnalysisSession({
  workspace,
  scenarios,
  children,
}: {
  workspace: Omit<WorkspaceState, "issues" | "simulation" | "comparison">;
  scenarios: Scenario[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const issues = useIssuesAnalysis(
    workspace.active,
    scenarios,
    pathname === "/workspace/issues",
  );
  const simulation = usePolicySimulation(
    workspace.active,
    workspace.scenarioJson,
  );
  const comparison = usePolicyComparison(
    workspace.defaultData,
    workspace.active,
    workspace.scenarioJson,
    workspace.scenarioName,
  );
  return (
    <WorkspaceContext.Provider
      value={{ ...workspace, issues, simulation, comparison }}
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
