"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { NavigationDrawer } from "@/components/navigation-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, StatusIndicator } from "@/components/ui/primitives";
import { useWorkspace } from "./workspace-provider";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/workspace/issues", label: "Issues", icon: ShieldAlert },
  { href: "/workspace/policies", label: "Policies", icon: FileText },
];

function WorkspaceLinks({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          aria-label={collapsed ? label : undefined}
          title={collapsed ? label : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            pathname === href
              ? "bg-selected text-selected-text"
              : "text-muted hover:bg-hover hover:text-text",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && label}
        </Link>
      ))}
    </nav>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { loading, error } = useWorkspace();
  const title =
    navigation.find((item) => item.href === pathname)?.label ??
    "What-if · planned";
  return (
    <div className="flex min-h-dvh">
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <aside
        aria-label="Workspace sidebar"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 md:flex",
          collapsed ? "w-[72px]" : "w-52",
        )}
      >
        <div className={cn("mb-8 px-2", collapsed && "px-1")}>
          <Brand compact={collapsed} />
        </div>
        {!collapsed && (
          <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.13em] text-muted">
            Workspace
          </p>
        )}
        <WorkspaceLinks collapsed={collapsed} />
        <div className="mt-auto space-y-4 pt-8">
          {!collapsed && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-medium">NovaCart demo</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Refunds &amp; replacements.
                <br />
                Existing v1 policy fixtures.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full justify-start"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-[18px] w-[18px]" />
            ) : (
              <>
                <PanelLeftClose
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                />
                <span className="text-xs">Collapse sidebar</span>
              </>
            )}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-[73px] items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <div className="md:hidden">
              <NavigationDrawer
                label="Workspace navigation"
                id="workspace-navigation"
              >
                <div className="mb-6 px-3">
                  <Brand />
                </div>
                <WorkspaceLinks />
                <p className="mt-8 px-3 text-xs leading-5 text-muted">
                  NovaCart demo · v1
                  <br />
                  Refunds &amp; replacements
                </p>
                <Link
                  href="/"
                  className="mt-4 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted"
                >
                  Product home
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </NavigationDrawer>
            </div>
            <span className="truncate text-sm font-medium">{title}</span>
            <span
              aria-hidden="true"
              className="mx-2 hidden text-border sm:inline"
            >
              /
            </span>
            <span className="hidden text-xs text-muted sm:inline">
              NovaCart
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline-flex">
              <StatusIndicator
                status={
                  error ? "offline" : loading ? "connecting" : "connected"
                }
                label={
                  error
                    ? "Data unavailable"
                    : loading
                      ? "Loading fixtures"
                      : "Fixtures loaded"
                }
              />
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto max-w-page px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <FileText aria-hidden="true" className="h-4 w-4" />
              <span>Refunds &amp; replacements</span>
            </div>
            <Badge>Demo workspace · v1</Badge>
          </div>
          {children}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-xs text-muted">
            <span>LLM-assisted extraction. Deterministic findings.</span>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1 rounded-md hover:text-text"
            >
              PolicyForge home
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
