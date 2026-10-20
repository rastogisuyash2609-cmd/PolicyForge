import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export const metadata: Metadata = {
  title: { default: "Workspace | PolicyForge", template: "%s | PolicyForge" },
  description:
    "Explore NovaCart policy rules, deterministic findings, and customer journey simulations.",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
