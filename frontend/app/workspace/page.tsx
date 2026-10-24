import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = { title: "Issues" };

export default function Workspace() {
  return <WorkspaceView view="issues" />;
}
