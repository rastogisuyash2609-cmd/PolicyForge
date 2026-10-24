import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";
export const metadata: Metadata = {
  title: "Reports",
  description: "Inspect and export real deterministic analysis evidence.",
};
export default function ReportsPage() {
  return <WorkspaceView view="reports" />;
}
