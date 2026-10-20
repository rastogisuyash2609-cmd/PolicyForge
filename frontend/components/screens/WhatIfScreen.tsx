"use client";
import { GitCompareArrows } from "lucide-react";
import type { DefaultData } from "@/lib/api";
import {
  Badge,
  Card,
  EmptyState,
  SectionHeader,
} from "@/components/ui/primitives";

export function WhatIfScreen({
  defaultData: _,
}: {
  defaultData: DefaultData | null;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Policy comparison"
        title="Understand the impact of a change"
        description="Compare customer journeys across two policy versions."
        action={<Badge>Planned workflow</Badge>}
      />
      <Card>
        <EmptyState
          icon={<GitCompareArrows aria-hidden="true" className="h-5 w-5" />}
          title="Comparison workspace is coming next"
          description="The backend supports behavioral comparison. This workspace has not been connected yet; no comparison has been run here."
        />
      </Card>
    </div>
  );
}
