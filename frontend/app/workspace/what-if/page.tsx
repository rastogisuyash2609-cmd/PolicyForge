import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = {
  title: "What-if",
  description:
    "Compare explicit rule sets with deterministic journeys, actual outcome changes and observed coverage.",
};
export default function WhatIfPage() {
  return <WorkspaceView view="what-if" />;
}
