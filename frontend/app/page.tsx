"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Moon, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import { api, type DefaultData } from "@/lib/api";
import { IssuesScreen } from "@/components/screens/IssuesScreen";
import { PoliciesScreen } from "@/components/screens/PoliciesScreen";
import { WhatIfScreen } from "@/components/screens/WhatIfScreen";
import {
  Alert,
  Badge,
  Button,
  Card,
  Skeleton,
  StatusIndicator,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme-provider";

const TABS = [
  { id: "issues", label: "Issues" },
  { id: "policies", label: "Policies" },
  { id: "whatif", label: "What-if" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("issues");
  const [defaultData, setDefaultData] = useState<DefaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDefaultData(await api.getDefaultData());
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "The policy data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  const status = error ? "offline" : loading ? "connecting" : "connected";

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-page items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              PolicyForge
            </span>
            <span className="mx-2 hidden h-5 w-px bg-border sm:block" />
            <span className="hidden text-sm text-muted sm:block">
              Policy workspace
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline-flex">
              <StatusIndicator
                status={status}
                label={
                  status === "connected"
                    ? "Engine connected"
                    : status === "offline"
                      ? "Engine unavailable"
                      : "Connecting"
                }
              />
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              aria-pressed={theme === "dark"}
              title={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
              ) : (
                <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
              )}
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-page items-center justify-between px-1 sm:px-3 lg:px-5">
          <Tabs
            items={TABS}
            value={activeTab}
            onChange={setActiveTab}
            idPrefix="workspace"
            label="Main navigation"
          />
          <span className="pr-3 text-xs text-muted sm:hidden">
            <StatusIndicator status={status} label={status} />
          </span>
          <span className="hidden pr-3 text-xs text-muted sm:block">
            Quiet intelligence. Clear decisions.
          </span>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-page px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <FileText aria-hidden="true" className="h-4 w-4" />
            <span>NovaCart</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span className="text-text">Refunds &amp; replacements</span>
          </div>
          <Badge>Demo workspace · v1</Badge>
        </div>
        {TABS.map((item) => (
          <section
            key={item.id}
            id={`workspace-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`workspace-tab-${item.id}`}
            hidden={activeTab !== item.id}
            tabIndex={0}
            className="min-w-0 rounded-xl focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {activeTab === item.id &&
              (loading ? (
                <WorkspaceSkeleton />
              ) : error ? (
                <Card className="p-5 sm:p-8">
                  <Alert title="Unable to load the workspace">{error}</Alert>
                  <Button className="mt-5" onClick={fetchData}>
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Retry connection
                  </Button>
                </Card>
              ) : (
                <>
                  {item.id === "issues" && (
                    <IssuesScreen defaultData={defaultData} />
                  )}
                  {item.id === "policies" && (
                    <PoliciesScreen defaultData={defaultData} />
                  )}
                  {item.id === "whatif" && (
                    <WhatIfScreen defaultData={defaultData} />
                  )}
                </>
              ))}
          </section>
        ))}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-xs text-muted">
          <span>
            PolicyForge <span aria-hidden="true">·</span> Policy verification
            workspace
          </span>
          <span>LLM-assisted extraction. Deterministic findings.</span>
        </footer>
      </main>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading policy workspace"
      className="space-y-6"
    >
      <span className="sr-only">Loading policy workspace</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
