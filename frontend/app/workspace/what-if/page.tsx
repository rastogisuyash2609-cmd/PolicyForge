import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = {
  title: "What-if (planned)",
  description:
    "A development placeholder for a future policy comparison workflow.",
};
export default function WhatIfPage() {
  return <WorkspaceView view="what-if" />;
}
