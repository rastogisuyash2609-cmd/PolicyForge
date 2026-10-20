"use client";
import {
  FIELD_TYPES,
  OPERATORS,
  type Condition,
  type StateField,
} from "../../lib/policy-domain";
import { Button } from "../ui/primitives";

export const leaf = (): Condition => ({
  field: "item_delivered",
  op: "IS_TRUE",
  value: true,
});
export function ConditionEditor({
  value,
  onChange,
  path = "Condition",
  depth = 0,
}: {
  value: Condition;
  onChange: (value: Condition) => void;
  path?: string;
  depth?: number;
}) {
  const group = "all" in value ? "all" : "any" in value ? "any" : null;
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium">{path}</legend>
      <label className="block text-xs text-muted">
        Match type
        <select
          aria-label={`${path} match type`}
          className="policy-input mt-1"
          value={group ?? "leaf"}
          onChange={(e) =>
            onChange(
              e.target.value === "leaf"
                ? leaf()
                : e.target.value === "all"
                  ? { all: [leaf()] }
                  : { any: [leaf()] },
            )
          }
        >
          <option value="leaf">Single condition</option>
          <option value="all">All conditions (AND)</option>
          <option value="any">Any condition (OR)</option>
        </select>
      </label>
      {group ? (
        <>
          {(value as { all?: Condition[]; any?: Condition[] })[group]!.map(
            (child, index, children) => (
              <div key={index} className="space-y-2">
                <ConditionEditor
                  value={child}
                  path={`${path} ${index + 1}`}
                  depth={depth + 1}
                  onChange={(next) =>
                    onChange({
                      [group]: children.map((old, i) =>
                        i === index ? next : old,
                      ),
                    } as Condition)
                  }
                />
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() =>
                    onChange({
                      [group]: children.filter((_, i) => i !== index),
                    } as Condition)
                  }
                  aria-label={`Remove ${path.toLowerCase()} ${index + 1}`}
                >
                  Remove condition
                </Button>
              </div>
            ),
          )}
          <Button
            variant="secondary"
            size="small"
            disabled={
              depth >= 7 ||
              (value as { all?: Condition[]; any?: Condition[] })[group]!
                .length >= 50
            }
            onClick={() =>
              onChange({
                [group]: [
                  ...(value as { all?: Condition[]; any?: Condition[] })[
                    group
                  ]!,
                  leaf(),
                ],
              } as Condition)
            }
          >
            Add condition
          </Button>
        </>
      ) : (
        "field" in value && (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              State field
              <select
                aria-label={`${path} state field`}
                className="policy-input mt-1"
                value={value.field}
                onChange={(e) => {
                  const field = e.target.value as StateField;
                  const type = FIELD_TYPES[field];
                  onChange({
                    field,
                    op: type === "boolean" ? "IS_TRUE" : "EQ",
                    value:
                      type === "boolean"
                        ? true
                        : type === "tier"
                          ? "STANDARD"
                          : 0,
                  });
                }}
              >
                {Object.keys(FIELD_TYPES).map((field) => (
                  <option key={field} value={field}>
                    {field.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Operation
              <select
                aria-label={`${path} operation`}
                className="policy-input mt-1"
                value={value.op}
                onChange={(e) =>
                  onChange({
                    ...value,
                    op: e.target.value as typeof value.op,
                    value: ["IN", "NIN"].includes(e.target.value)
                      ? [value.value]
                      : Array.isArray(value.value)
                        ? value.value[0]
                        : value.value,
                  })
                }
              >
                {OPERATORS.map((op) => (
                  <option key={op}>{op}</option>
                ))}
              </select>
            </label>
            {!value.op.startsWith("IS_") && (
              <label className="block text-xs text-muted sm:col-span-2">
                Value{" "}
                {value.op === "IN" || value.op === "NIN"
                  ? "(edit arrays in advanced JSON)"
                  : ""}
                {["IN", "NIN"].includes(value.op) ? (
                  <input
                    className="policy-input mt-1"
                    readOnly
                    value={JSON.stringify(value.value)}
                  />
                ) : FIELD_TYPES[value.field] === "boolean" ||
                  FIELD_TYPES[value.field] === "tier" ? (
                  <select
                    aria-label={`${path} value`}
                    className="policy-input mt-1"
                    value={String(value.value)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        value:
                          FIELD_TYPES[value.field] === "boolean"
                            ? e.target.value === "true"
                            : e.target.value,
                      })
                    }
                  >
                    {(FIELD_TYPES[value.field] === "boolean"
                      ? ["true", "false"]
                      : ["STANDARD", "VIP"]
                    ).map((choice) => (
                      <option key={choice}>{choice}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`${path} value`}
                    type="number"
                    min={0}
                    className="policy-input mt-1"
                    value={typeof value.value === "number" ? value.value : ""}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        value:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
              </label>
            )}
          </div>
        )
      )}
    </fieldset>
  );
}
