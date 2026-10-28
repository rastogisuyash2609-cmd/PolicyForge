import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  FileSearch,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Route,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import rules from "../../data/novacart/rules_v1.json";
import { Brand } from "@/components/brand";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Badge, Card } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "PolicyForge — Policy clarity, before the consequences",
  description:
    "Understand how business policies behave. Explore deterministic simulation, traceable findings, and customer journey analysis with PolicyForge.",
};

const capabilities = [
  {
    icon: ShieldCheck,
    title: "Find the disagreement",
    description:
      "Investigate contradictions, gaps, and other findings produced by deterministic Python code.",
  },
  {
    icon: FlaskConical,
    title: "Test the customer journey",
    description:
      "Run the sample suite, adjust event timing, and see how the policy responds.",
  },
  {
    icon: Route,
    title: "Follow the evidence",
    description:
      "Inspect fired rules, source quotations, and the state after each simulated event.",
  },
];
const steps = [
  {
    number: "01",
    title: "Read the rules",
    text: "Review NovaCart’s existing refund and replacement rules alongside their source text.",
    href: "/workspace/policies",
    link: "Browse policies",
  },
  {
    number: "02",
    title: "Simulate a journey",
    text: "Run sample journeys. Change the timing of an event and inspect the resulting decision.",
    href: "/workspace/issues",
    link: "Explore simulations",
  },
  {
    number: "03",
    title: "Investigate the finding",
    text: "Follow the decision trace and inspect a reduced reproduction of a policy issue.",
    href: "/workspace/issues",
    link: "Investigate issues",
  },
  {
    number: "04",
    title: "Examine what changes",
    text: "Compare two explicit rule sets over shared journeys in the What-if workspace.",
    href: "/workspace/what-if",
    link: "Compare policies",
  },
];

export default function Home() {
  const previewRules = [
    "rule_refund_past_deadline",
    "rule_refund_after_replacement_cancelled",
  ].map((id) => rules.find((rule) => rule.id === id)!);
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden bg-[#101827] text-white"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 border-l border-white/5 bg-[linear-gradient(90deg,transparent_79px,rgba(255,255,255,0.025)_80px),linear-gradient(transparent_79px,rgba(255,255,255,0.025)_80px)] bg-[size:80px_80px]"
          />
          <div className="relative mx-auto grid max-w-page gap-14 px-4 pb-32 pt-16 sm:px-6 sm:pb-40 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-20 lg:px-8 lg:pt-24">
            <div>
              <p className="mb-6 inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.15em] text-[#BEB9FF]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A8A2FF]" />
                Clarity at the rule level
              </p>
              <h1
                id="hero-heading"
                className="max-w-[850px] text-[2.5rem] font-medium leading-[1.08] tracking-[-0.045em] sm:text-[3.5rem] lg:text-[4rem]"
              >
                Find policy conflicts before they become{" "}
                <span className="text-[#BEB9FF]">real problems.</span>
              </h1>
              <p className="mt-7 max-w-[580px] text-base leading-7 text-[#CBD5E1] sm:text-lg sm:leading-8">
                Understand how policies behave, simulate customer journeys, and
                uncover contradictions through traceable, deterministic
                analysis.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/workspace"
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#635BDB] px-5 text-sm font-medium text-white transition-colors hover:bg-[#5249C4]"
                >
                  Explore PolicyForge
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm text-[#E2E8F0] transition-colors hover:bg-white/5"
                >
                  How it works
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-6 text-xs text-[#A1AEC3]">
                Explore the NovaCart demo. No account required.
              </p>
            </div>
            <div
              className="hidden self-center lg:block"
              aria-label="How PolicyForge produces evidence"
            >
              <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#A1AEC3]">
                <span className="h-px w-8 bg-[#635BDB]" />
                From language to evidence
              </div>
              {[
                {
                  icon: FileText,
                  title: "Policy language",
                  detail: "Original source clauses",
                },
                {
                  icon: Braces,
                  title: "Structured rules",
                  detail: "LLM-assisted extraction",
                },
                {
                  icon: ScanLine,
                  title: "Deterministic analysis",
                  detail: "Python evaluates every decision",
                },
              ].map(({ icon: Icon, title, detail }, index) => (
                <div key={title} className="relative flex gap-4 pb-9 last:pb-0">
                  {index < 2 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-5 top-10 w-px bg-[#334155]"
                    />
                  )}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#334155] bg-[#172132]">
                    <Icon
                      aria-hidden="true"
                      className="h-[18px] w-[18px] text-[#BEB9FF]"
                    />
                  </span>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#A1AEC3]">
                      {detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="product"
          aria-labelledby="preview-heading"
          className="relative mx-auto -mt-16 max-w-page scroll-mt-8 px-4 sm:-mt-20 sm:px-6 lg:px-8"
        >
          <Card className="overflow-hidden shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-sidebar px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-selected text-selected-text">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">Inside PolicyForge</span>
                <span
                  aria-hidden="true"
                  className="hidden text-border sm:inline"
                >
                  /
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  NovaCart
                </span>
              </div>
              <Badge>Source fixture preview</Badge>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="border-b border-border p-5 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="eyebrow">One journey. Two policy clauses.</p>
                <h2
                  id="preview-heading"
                  className="mt-3 text-2xl font-medium leading-tight tracking-tight sm:text-[1.75rem]"
                >
                  A replacement is cancelled.
                  <br className="hidden sm:block" /> The refund window has
                  closed.
                </h2>
                <p className="mt-4 max-w-reading text-sm leading-6 text-muted">
                  What should happen next? Make the interaction between rules
                  visible, then investigate it in the workspace.
                </p>
                <ol
                  aria-label="Example customer journey"
                  className="mt-7 space-y-0"
                >
                  {[
                    { day: "00", event: "Item delivered" },
                    { day: "00", event: "Replacement requested" },
                    { day: "00", event: "Replacement cancelled" },
                    { day: "31", event: "Refund requested" },
                  ].map((event, index) => (
                    <li
                      key={event.event}
                      className="relative flex items-center gap-4 pb-5 last:pb-0"
                    >
                      {index < 3 && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-0 left-[5px] top-3 w-px bg-border"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={
                          index === 3
                            ? "relative h-3 w-3 shrink-0 rounded-full border-[3px] border-primary bg-surface"
                            : "relative h-3 w-3 shrink-0 rounded-full border-[3px] border-border bg-surface"
                        }
                      />
                      <span className="font-mono text-xs text-muted">
                        DAY {event.day}
                      </span>
                      <span className="text-sm font-medium">{event.event}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 text-xs leading-5 text-muted">
                  Illustrative journey using existing NovaCart rules. This
                  static preview does not run analysis.
                </p>
              </div>
              <div className="space-y-4 bg-bg/50 p-5 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow">Grounded in the source</p>
                  <FileSearch
                    aria-hidden="true"
                    className="h-4 w-4 text-muted"
                  />
                </div>
                {previewRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-border bg-surface p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">{rule.name}</h3>
                      <Badge
                        tone={rule.effect === "ALLOW" ? "success" : "danger"}
                      >
                        {rule.effect === "ALLOW" ? "Allows" : "Denies"} refund
                      </Badge>
                    </div>
                    <blockquote className="border-l-2 border-border pl-3 text-sm leading-6 text-muted">
                      “{rule.source.verbatim_sentence}”
                    </blockquote>
                    <p className="mt-4 text-[11px] text-muted">
                      {rule.source.doc_name}
                    </p>
                  </div>
                ))}
                <Link
                  href="/workspace/policies"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-selected-text"
                >
                  Explore the actual rules
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Card>
        </section>

        <section
          aria-labelledby="capabilities-heading"
          className="mx-auto max-w-page px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="max-w-2xl">
            <p className="eyebrow">Evidence over assumptions</p>
            <h2
              id="capabilities-heading"
              className="mt-4 text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
            >
              Know why a decision happens.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted">
              Policy language can be ambiguous. Its behavior shouldn’t be a
              mystery. Explore the working tools in the current demo.
            </p>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <div key={title} className="border-t border-border pt-6">
                <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-selected text-selected-text">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {description}
                </p>
                <p className="mt-5 flex items-center gap-2 text-xs text-success">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  Available in the workspace
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-start sm:p-6">
            <GitCompareArrows
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-muted"
            />
            <div>
              <h3 className="text-sm font-medium">
                Policy comparison, with shared test input
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                Compare demo rule sets or an explicit active-policy snapshot in
                What-if. Natural-language extraction is opt-in through the
                Analyze workspace.
              </p>
            </div>
            <Badge className="shrink-0 self-start">Comparison available</Badge>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="process-heading"
          className="scroll-mt-8 border-y border-border bg-surface"
        >
          <div className="mx-auto max-w-page px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">How it works</p>
                <h2
                  id="process-heading"
                  className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl"
                >
                  From a rule to a reason.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted">
                The LLM helps structure and explain.
                <br />
                The deterministic engine produces findings.
              </p>
            </div>
            <ol className="mt-12 grid gap-9 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <li key={step.number} className="border-t border-border pt-5">
                  <span className="font-mono text-xs text-selected-text">
                    {step.number}
                  </span>
                  <h3 className="mt-6 text-base font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    {step.text}
                  </p>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md text-xs font-medium text-selected-text"
                    >
                      {step.link}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </Link>
                  ) : (
                    <p className="mt-7 text-xs text-muted">{step.link}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="cta-heading"
          className="mx-auto max-w-page px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-selected/40 p-7 sm:p-10 md:flex-row md:items-center">
            <div>
              <p className="eyebrow text-selected-text">
                A clearer view of policy
              </p>
              <h2
                id="cta-heading"
                className="mt-4 max-w-xl text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              >
                Understand what your policies actually do.
              </h2>
              <p className="mt-4 text-sm text-text/80">
                Start with a real example in the NovaCart workspace.
              </p>
            </div>
            <Link
              href="/workspace"
              className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Explore PolicyForge
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-page flex-col justify-between gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <Brand />
            <p className="mt-2 text-xs text-muted">
              Policy simulation. Traceable decisions.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 text-xs text-muted"
          >
            <Link
              href="#product"
              className="inline-flex min-h-11 items-center rounded-md hover:text-text"
            >
              Product
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-11 items-center rounded-md hover:text-text"
            >
              How it works
            </Link>
            <Link
              href="/workspace"
              className="inline-flex min-h-11 items-center rounded-md hover:text-text"
            >
              Workspace
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
