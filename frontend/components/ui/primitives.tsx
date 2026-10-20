import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AlertCircle, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { cn } from "../../lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "border-border bg-bg text-muted",
  primary: "border-primary/15 bg-selected text-selected-text",
  success: "border-success/20 bg-success-bg text-success",
  warning: "border-warning/20 bg-warning-bg text-warning",
  danger: "border-danger/20 bg-danger-bg text-danger",
  info: "border-info/20 bg-info-bg text-info",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "default" | "icon" | "small";
    loading?: boolean;
  }
>(
  (
    {
      variant = "primary",
      size = "default",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-fast disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled disabled:text-disabled-text",
        variant === "primary" &&
          "border-transparent bg-primary text-on-primary shadow-card hover:bg-primary-hover",
        variant === "secondary" &&
          "border-border bg-surface text-text shadow-card hover:bg-hover",
        variant === "ghost" &&
          "border-transparent text-muted hover:bg-hover hover:text-text",
        size === "icon"
          ? "w-11 p-2.5"
          : size === "small"
            ? "px-3 py-2"
            : "px-4 py-2.5",
        className,
      )}
      {...props}
    >
      {loading && (
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-page-title text-text">{title}</h1>
        {description && (
          <div className="mt-2 max-w-reading text-sm leading-6 text-muted">
            {description}
          </div>
        )}
      </div>
      {action && <div className="self-start sm:self-auto">{action}</div>}
    </div>
  );
}
export function Alert({
  title,
  children,
  tone = "danger",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { title: string; tone?: Tone }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg border p-4 text-sm",
        tones[tone],
        className,
      )}
      {...props}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 leading-6">{children}</div>}
      </div>
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg text-muted">
        {icon ?? <Check aria-hidden="true" className="h-5 w-5" />}
      </div>
      <h2 className="text-section-title">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-border/60", className)}
      {...props}
    />
  );
}
export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
export function StatusIndicator({
  status,
  label,
}: {
  status: "connected" | "connecting" | "offline";
  label: string;
}) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-xs text-muted"
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "connected"
            ? "bg-success"
            : status === "offline"
              ? "bg-danger"
              : "bg-warning",
        )}
      />
      {label}
    </span>
  );
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0 rounded-xl border border-border bg-surface shadow-card">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl px-5 py-3 text-sm font-medium text-text transition-colors duration-fast hover:bg-hover">
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
          {title}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted transition-transform duration-base group-open:rotate-180"
        />
      </summary>
      <div className="min-w-0 border-t border-border p-5">{children}</div>
    </details>
  );
}
