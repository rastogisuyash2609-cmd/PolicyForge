import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Review NovaCart refund and replacement rules with their original source quotations.",
};
export default function PoliciesPage() {
  return <WorkspaceView view="policies" />;
}
