import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = {
  title: "Issues",
  description:
    "Investigate deterministic policy findings and simulate NovaCart customer journeys.",
};
export default function IssuesPage() {
  return <WorkspaceView view="issues" />;
}
