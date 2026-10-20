"use client";

import { RefreshCw } from "lucide-react";
import { Alert, Button, Card, Skeleton } from "@/components/ui/primitives";
import { AnalyzeScreen } from "@/components/screens/AnalyzeScreen";
import { IssuesScreen } from "@/components/screens/IssuesScreen";
import { PoliciesScreen } from "@/components/screens/PoliciesScreen";
import { WhatIfScreen } from "@/components/screens/WhatIfScreen";
import { useWorkspace } from "./workspace-provider";

export function WorkspaceView({
  view,
}: {
  view: "issues" | "policies" | "what-if" | "analyze";
}) {
  const { defaultData, loading, error, retry } = useWorkspace();
  if (view === "what-if") return <WhatIfScreen defaultData={defaultData} />;
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading policy workspace"
        className="space-y-6"
      >
        <span className="sr-only">Loading policy workspace</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (error)
    return (
      <Card className="p-5 sm:p-8">
        <Alert title="Unable to load the workspace">{error}</Alert>
        <Button className="mt-5" onClick={retry}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry connection
        </Button>
      </Card>
    );
  if (view === "analyze") return <AnalyzeScreen />;
  return view === "issues" ? <IssuesScreen /> : <PoliciesScreen />;
}
