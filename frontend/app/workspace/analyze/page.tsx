import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";
export const metadata: Metadata = {
  title: "Analyze Policy",
  description:
    "Review demo policies or create supported structured rules and run offline deterministic analysis.",
};
export default function AnalyzePage() {
  return <WorkspaceView view="analyze" />;
}
