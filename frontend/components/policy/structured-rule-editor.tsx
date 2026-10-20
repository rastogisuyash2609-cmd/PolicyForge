"use client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  editableRules,
  starterRule,
  type Condition,
} from "@/lib/policy-domain";
import type { PolicyRule } from "@/lib/api";
import { Alert, Button, Disclosure } from "@/components/ui/primitives";
import { ConditionEditor } from "./condition-editor";

export function StructuredRuleEditor() {
  const { draft, setDraft, editorIndex, setEditorIndex } = useWorkspace();
  const rules = editableRules(draft.rulesJson),
    rule = rules?.[editorIndex];
  function update(patch: Partial<PolicyRule>) {
    if (!rules) return;
    setDraft((old) => ({
      ...old,
      mode: "manual",
      rulesJson: JSON.stringify(
        rules.map((r, i) => (i === editorIndex ? { ...r, ...patch } : r)),
        null,
        2,
      ),
    }));
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Structured rule editor</h3>
        <Button
          variant="secondary"
          size="small"
          disabled={!rules || rules.length >= 100}
          onClick={() => {
            if (!rules) return;
            let index = rules.length + 1;
            while (rules.some((r) => r.id === `manual_refund_${index}`))
              index++;
            setEditorIndex(rules.length);
            setDraft((old) => ({
              ...old,
              mode: "manual",
              rulesJson: JSON.stringify(
                [...rules, starterRule(index)],
                null,
                2,
              ),
            }));
          }}
        >
          Add rule
        </Button>
      </div>
      {!rules && (
        <Alert tone="warning" title="Fix the JSON structure first">
          Use the advanced editor below. No invalid rule set can be activated.
        </Alert>
      )}
      {rules && rules.length > 0 && (
        <label className="block text-xs text-muted">
          Rule to edit
          <select
            className="policy-input mt-1"
            value={Math.min(editorIndex, rules.length - 1)}
            onChange={(e) => setEditorIndex(Number(e.target.value))}
          >
            {rules.map((r, i) => (
              <option key={i} value={i}>
                {i + 1}. {r.name || "Unnamed rule"}
              </option>
            ))}
          </select>
        </label>
      )}
      {rule && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Rule ID
              <input
                className="policy-input mt-1"
                value={rule.id}
                onChange={(e) => update({ id: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted">
              Rule name
              <input
                className="policy-input mt-1"
                value={rule.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted">
              Decision
              <select
                className="policy-input mt-1"
                value={rule.decision}
                onChange={(e) =>
                  update({
                    decision: e.target.value as PolicyRule["decision"],
                    trigger: `${e.target.value}_REQUESTED`,
                  })
                }
              >
                <option>REFUND</option>
                <option>REPLACEMENT</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Effect
              <select
                className="policy-input mt-1"
                value={rule.effect}
                onChange={(e) =>
                  update({ effect: e.target.value as PolicyRule["effect"] })
                }
              >
                <option>ALLOW</option>
                <option>DENY</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Priority
              <input
                type="number"
                step={1}
                className="policy-input mt-1"
                value={rule.priority}
                onChange={(e) => update({ priority: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-muted">
              Trigger
              <input
                className="policy-input mt-1"
                readOnly
                value={rule.trigger}
              />
            </label>
          </div>
          <ConditionEditor
            value={rule.when as Condition}
            onChange={(when) =>
              update({ when: when as Record<string, unknown> })
            }
          />
          <label className="block text-xs text-muted">
            Overrides (comma-separated IDs)
            <input
              className="policy-input mt-1"
              value={rule.overrides.join(", ")}
              onChange={(e) =>
                update({
                  overrides: e.target.value
                    .split(",")
                    .map((id) => id.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted">
            Source document
            <input
              className="policy-input mt-1"
              value={rule.source.doc_name}
              onChange={(e) =>
                update({ source: { ...rule.source, doc_name: e.target.value } })
              }
            />
          </label>
          <label className="block text-xs text-muted">
            Source quotation (optional; never generated)
            <textarea
              rows={3}
              className="policy-input mt-1"
              value={rule.source.verbatim_sentence}
              onChange={(e) =>
                update({
                  source: { ...rule.source, verbatim_sentence: e.target.value },
                })
              }
            />
          </label>
          <p className="text-xs leading-5 text-muted">
            State updates and membership arrays can be edited in JSON. Values
            must match supported state types. All editor changes are manual
            rules.
          </p>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              setDraft((old) => ({
                ...old,
                mode: "manual",
                rulesJson: JSON.stringify(
                  rules?.filter((_, i) => i !== editorIndex),
                  null,
                  2,
                ),
              }));
              setEditorIndex(0);
            }}
          >
            Remove this rule
          </Button>
        </div>
      )}
      <Disclosure title="Advanced rule JSON / import">
        <label className="block text-xs text-muted">
          Rules JSON
          <textarea
            spellCheck={false}
            rows={16}
            className="policy-input mt-2 font-mono text-xs"
            value={draft.rulesJson}
            onChange={(e) => {
              setDraft((old) => ({
                ...old,
                mode: "manual",
                rulesJson: e.target.value,
              }));
              setEditorIndex(0);
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Paste an array of backend Rule objects. Unknown properties, invalid
          conditions, duplicate IDs and invalid overrides block activation.
        </p>
      </Disclosure>
    </div>
  );
}
