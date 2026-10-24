import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";
export const metadata: Metadata = {
  title: "Stress Testing",
  description:
    "Run bounded deterministic scenario suites against the active policy.",
};
export default function StressPage() {
  return <WorkspaceView view="stress-test" />;
}
