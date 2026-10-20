import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="PolicyForge home"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
        <ShieldCheck aria-hidden="true" className="h-5 w-5" />
      </span>
      {!compact && <span>PolicyForge</span>}
    </Link>
  );
}
