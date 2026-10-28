"use client";
import Link from "next/link";
import { ArrowRight, FileSearch, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { activateDraft, demoDraft, emptyDraft } from "@/lib/policy-domain";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
} from "@/components/ui/primitives";
import { RuleInspector } from "@/components/policy/rule-inspector";
import { StructuredRuleEditor } from "@/components/policy/structured-rule-editor";
import { ScenarioWorkbench } from "@/components/policy/scenario-workbench";

export function AnalyzeScreen() {
  const {
    defaultData,
    draft,
    setDraft,
    active,
    activate,
    editorIndex,
    setEditorIndex,
    compilation,
  } = useWorkspace();
  const review = activateDraft(draft, (active?.revision ?? 0) + 1);
  const hasDraft = draft.rulesJson !== "[]" || Boolean(draft.name.trim());
  const rules = review.value?.rules;
  const selected = rules?.[Math.min(editorIndex, rules.length - 1)];
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Policy analysis"
        title="Analyze a policy"
        description="Review known example rules or build your own. Activate a valid rule set, then test its behavior with the deterministic engine."
        action={<Badge>AI opt-in · deterministic testing</Badge>}
      />
      <Alert title="Compile, review, then activate" tone="info">
        NVIDIA extraction runs only after you consent and click Compile. Typing never
        sends an AI request. Demo and manual rules work without AI access.
      </Alert>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">01 / Prepare rules</p>
              <h2 className="mt-2 text-section-title">Policy input</h2>
            </div>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                setDraft(emptyDraft());
                setEditorIndex(0);
              }}
            >
              Clear draft
            </Button>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Policy input mode"
          >
            <Button
              variant={draft.mode === "demo" ? "primary" : "secondary"}
              size="small"
              aria-pressed={draft.mode === "demo"}
              onClick={() => {
                if (draft.mode !== "demo" && defaultData) {
                  setDraft(demoDraft(defaultData, draft.example || "v1"));
                  setEditorIndex(0);
                }
              }}
            >
              Demo Policy
            </Button>
            <Button
              variant={draft.mode === "manual" ? "primary" : "secondary"}
              size="small"
              aria-pressed={draft.mode === "manual"}
              onClick={() => setDraft((old) => ({ ...old, mode: "manual" }))}
            >
              Custom structured rules
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted">
            Domain: e-commerce refunds and replacements. Switching to Demo
            Policy loads known fixture rules; the active policy changes only
            when you activate.
          </p>
          <label className="block text-xs text-muted">
            Example policy
            <select
              className="policy-input mt-1"
              value={draft.mode === "demo" ? draft.example : ""}
              disabled={!defaultData}
              onChange={(e) => {
                if (defaultData && e.target.value) {
                  setDraft(
                    demoDraft(defaultData, e.target.value as "v1" | "v2"),
                  );
                  setEditorIndex(0);
                }
              }}
            >
              <option value="">Select an example…</option>
              <option value="v1">NovaCart v1 · original rules</option>
              <option value="v2">NovaCart v2 · revised rule fixture</option>
            </select>
          </label>
          <label className="block text-xs text-muted">
            Policy name
            <input
              maxLength={120}
              className="policy-input mt-1"
              placeholder="Name this rule set"
              value={draft.name}
              onChange={(e) =>
                setDraft((old) => ({ ...old, name: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs text-muted">
            Policy text / reference document
            <textarea
              rows={12}
              maxLength={50_000}
              className="policy-input mt-2 leading-7"
              placeholder="Paste refund or replacement policy text. Compile explicitly, or create structured rules manually below."
              value={draft.text}
              onChange={(e) =>
                setDraft((old) => ({
                  ...old,
                  text: e.target.value,
                  referenceEdited: true,
                }))
              }
            />
          </label>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>
              {draft.text.length.toLocaleString()} / 50,000 characters
            </span>
            <span>Live compilation accepts up to 4,000 characters</span>
          </div>
          {draft.referenceEdited && (
            <p className="text-xs leading-5 text-warning">
              Reference text edited. Existing rules and quotations have not
              changed.
            </p>
          )}
          {draft.example === "v2" && (
            <p className="text-xs leading-5 text-muted">
              The v2 rule fixture contains revised source clauses. The reference
              document pack above remains the original NovaCart documents.
            </p>
          )}
          <div className="space-y-4 rounded-lg border border-border bg-bg p-4" aria-busy={compilation.loading}>
            <h3 className="text-sm font-medium">Compile with NVIDIA</h3>
            <p className="text-xs leading-6 text-muted">One bounded provider request · 1,536 output tokens · no automatic retry or repair. Review every rule for omissions and meaning before activation.</p>
            <label className="block text-xs text-muted">Workspace access code
              <input type="password" autoComplete="off" maxLength={256} className="policy-input mt-1"
                value={compilation.accessCode} onChange={(e) => compilation.setAccessCode(e.target.value)} />
            </label>
            <p className="text-xs text-muted">Provided by the workspace owner; held in memory for this session. Provider credentials stay on the backend.</p>
            <label className="flex min-h-11 items-center gap-3 text-xs leading-6">
              <input type="checkbox" checked={compilation.consent} onChange={(e) => compilation.setConsent(e.target.checked)} />
              I authorize one paid compilation of this policy.
            </label>
            <Button loading={compilation.loading} disabled={!compilation.consent || !compilation.accessCode || !draft.name.trim() || !draft.text.trim() || draft.text.length > 4000}
              onClick={compilation.run}>Compile with NVIDIA</Button>
            {compilation.loading && <p role="status" className="text-xs text-muted">Compiling once. Editing or leaving this draft discards the response but may not cancel provider billing.</p>}
            {compilation.error && <Alert title="Compilation did not replace your rules">{compilation.error}</Alert>}
            {draft.mode === "ai" && draft.compilation && <div role="status" className="space-y-2 text-xs leading-6 text-success">
              <p>{draft.referenceEdited ? "Previous compiled rules retained; the edited policy text has not been validated." : "Compilation validated · review the draft, then activate."}</p>
              <p className="break-words text-muted">{draft.compilation.model} · request {draft.compilation.requestId}</p>
              <p className="break-words text-muted">Usage: {JSON.stringify(draft.compilation.usage.provider_usage ?? null)}</p>
            </div>}
          </div>
          {draft.mode === "manual" ? (
            <StructuredRuleEditor />
          ) : (
            <div className="rounded-lg border border-border bg-bg p-4 text-xs leading-6 text-muted">
              {draft.mode === "ai" ? "AI rules were validated locally. Choose Custom structured rules to make manual edits; edited rules are labeled manual." : <>Demo rules are predefined repository fixtures, not freshly
              generated AI output. Choose Custom structured rules to edit them
              or add a rule.</>}
            </div>
          )}
        </Card>
        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Active policy</p>
                <h2 className="mt-2 break-words text-section-title">
                  {active?.name ?? "No active policy"}
                </h2>
              </div>
              <Badge tone={active?.origin === "manual" ? "info" : "primary"}>
                {active?.origin === "ai" ? "AI compiled" : active?.origin === "manual" ? "Manual rules" : "Demo Policy"}
              </Badge>
            </div>
            {active && (
              <p className="mt-3 break-words font-mono text-xs text-muted">
                {active.rules.length} rules · revision {active.revision} ·{" "}
                {active.fingerprint}
              </p>
            )}
            <p className="mt-3 text-xs leading-6 text-muted">
              Drafts stay separate from the active rules. Activating replaces
              the analysis session and clears earlier suite and simulation
              results.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href="/workspace/policies"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-xs font-medium text-selected-text"
              >
                View active rules
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/workspace/issues"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-xs font-medium text-selected-text"
              >
                Run Issues suite
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-section-title">Draft rule review</h2>
              {rules && <Badge>{rules.length} valid rules</Badge>}
            </div>
            {!hasDraft ? (
              <EmptyState
                icon={<FileSearch aria-hidden="true" className="h-5 w-5" />}
                title="Start with a policy"
                description="Select a demo to inspect known rules, or choose Custom structured rules and add your first rule."
              />
            ) : review.errors.length > 0 ? (
              <Alert title="Rules are not ready to activate">
                <ul className="list-inside list-disc space-y-1 break-words text-xs">
                  {review.errors.slice(0, 12).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
                {review.errors.length > 12 && (
                  <p className="mt-2 text-xs">
                    {review.errors.length - 12} more errors. Fix these first.
                  </p>
                )}
              </Alert>
            ) : (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-success"
              >
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Validation passed · ready to activate
              </div>
            )}
            {review.warnings.length > 0 && (
              <Alert tone="warning" title="Review these warnings">
                <ul className="list-inside list-disc space-y-1 break-words text-xs">
                  {review.warnings.slice(0, 6).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <Button
              className="w-full"
              disabled={!review.value}
              onClick={activate}
            >
              Activate rules
            </Button>
            {review.value &&
              active?.fingerprint === review.value.fingerprint &&
              active.name === draft.name.trim() &&
              active.origin === draft.mode && (
                <p role="status" className="text-xs text-success">
                  This rule set is active. Choose a journey below or open
                  Issues.
                </p>
              )}
          </Card>
          {rules && selected && (
            <div className="space-y-3">
              <label className="block text-xs text-muted">
                Inspect draft rule
                <select
                  className="policy-input mt-1"
                  value={Math.min(editorIndex, rules.length - 1)}
                  onChange={(e) => setEditorIndex(Number(e.target.value))}
                >
                  {rules.map((rule, i) => (
                    <option key={rule.id} value={i}>
                      {i + 1}. {rule.name}
                    </option>
                  ))}
                </select>
              </label>
              <RuleInspector rule={selected} manual={draft.mode === "manual"} aiCompiled={draft.mode === "ai"} />
            </div>
          )}
        </div>
      </div>
      <ScenarioWorkbench />
    </div>
  );
}
