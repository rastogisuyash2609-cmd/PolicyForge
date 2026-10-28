import type { DefaultData, JourneyEvent, PolicyRule } from "./api";

// Mirrors backend/policyforge/models.py. UI validation is deliberately stricter
// about scalar types than Pydantic's coercion and the engine's permissive payload.
export const EVENTS = [
  "ORDER_PLACED",
  "ITEM_DELIVERED",
  "REPLACEMENT_REQUESTED",
  "REFUND_REQUESTED",
  "RETURN_RECEIVED",
  "REPLACEMENT_CANCELLED",
  "ORDER_CANCELLED",
  "ITEM_DAMAGED_REPORTED",
  "REFUND_COMPLETED",
  "REPLACEMENT_DELIVERED",
  "CHARGEBACK_FILED",
  "CHARGEBACK_RESOLVED",
] as const;
export const OPERATORS = [
  "EQ",
  "NEQ",
  "LT",
  "LTE",
  "GT",
  "GTE",
  "IN",
  "NIN",
  "IS_TRUE",
  "IS_FALSE",
  "IS_NULL",
  "IS_NOT_NULL",
] as const;
export const FIELD_TYPES = {
  order_placed: "boolean",
  order_day: "day",
  item_delivered: "boolean",
  delivery_day: "day",
  days_since_delivery: "day",
  replacement_requested: "boolean",
  replacement_request_day: "day",
  replacement_cancelled: "boolean",
  replacement_cancel_day: "day",
  replacement_active: "boolean",
  replacement_completed: "boolean",
  replacement_completed_day: "day",
  refund_requested: "boolean",
  refund_request_day: "day",
  refund_completed: "boolean",
  refund_completed_day: "day",
  return_received: "boolean",
  item_damaged: "boolean",
  is_final_sale: "boolean",
  item_opened: "boolean",
  customer_tier: "tier",
  refund_eligibility_restored: "boolean",
  action_denied: "boolean",
  amount_paid: "number",
  refund_amount: "number",
  chargeback_active: "boolean",
} as const;
export type StateField = keyof typeof FIELD_TYPES;
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { field: StateField; op: (typeof OPERATORS)[number]; value?: unknown };
export type Scenario = {
  id: string;
  name: string;
  description: string;
  journey: JourneyEvent[];
};
export type PolicyDraft = {
  mode: "demo" | "manual" | "ai";
  compilation?: CompilationProvenance;
  example: "v1" | "v2" | "";
  name: string;
  text: string;
  rulesJson: string;
  referenceEdited: boolean;
};
export type ActivePolicy = {
  name: string;
  origin: "demo" | "manual" | "ai";
  compilation?: CompilationProvenance;
  rules: PolicyRule[];
  documents: string;
  fingerprint: string;
  revision: number;
  warnings: string[];
};
export type Validation<T> = {
  value: T | null;
  errors: string[];
  warnings: string[];
};
export type CompilationProvenance = { model: string; requestId: string; usage: Record<string, unknown>; finishReason: string };
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const scalarValid = (field: string, value: unknown) => {
  const kind = FIELD_TYPES[field as StateField];
  return kind === "boolean"
    ? typeof value === "boolean"
    : kind === "tier"
      ? value === "VIP" || value === "STANDARD"
      : kind === "day"
        ? value === null || (Number.isInteger(value) && Number(value) >= 0)
        : kind === "number" &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0;
};
function extras(
  x: Record<string, unknown>,
  keys: string[],
  path: string,
  errors: string[],
) {
  Object.keys(x)
    .filter((key) => !keys.includes(key))
    .forEach((key) => errors.push(`${path}: unsupported property ${key}.`));
}
function condition(
  x: unknown,
  path: string,
  errors: string[],
  warnings: string[],
  depth = 0,
): void {
  if (depth > 8) {
    errors.push(`${path}: use at most 8 nested condition levels.`);
    return;
  }
  if (!record(x)) {
    errors.push(`${path}: a condition must be an object.`);
    return;
  }
  if ("all" in x || "any" in x) {
    const key = "all" in x ? "all" : "any";
    extras(x, [key], path, errors);
    const nodes = x[key];
    if (!Array.isArray(nodes) || nodes.length > 50) {
      errors.push(
        `${path}: ${key} must be an array with at most 50 conditions.`,
      );
      return;
    }
    if (!nodes.length)
      warnings.push(
        `${path}: empty ${key} is ${key === "all" ? "always true" : "always false"}.`,
      );
    nodes.forEach((child, i) =>
      condition(child, `${path}.${key}[${i}]`, errors, warnings, depth + 1),
    );
    return;
  }
  extras(x, ["field", "op", "value"], path, errors);
  if (typeof x.field !== "string" || !Object.hasOwn(FIELD_TYPES, x.field)) {
    errors.push(`${path}: select a supported state field.`);
    return;
  }
  if (!OPERATORS.includes(x.op as (typeof OPERATORS)[number])) {
    errors.push(`${path}: unsupported operation.`);
    return;
  }
  const kind = FIELD_TYPES[x.field as StateField];
  if (["IS_TRUE", "IS_FALSE"].includes(String(x.op)) && kind !== "boolean")
    errors.push(`${path}: ${x.op} requires a boolean field.`);
  if (
    ["LT", "LTE", "GT", "GTE"].includes(String(x.op)) &&
    !["day", "number"].includes(kind)
  )
    errors.push(`${path}: ordering requires a numeric field.`);
  if (String(x.op).startsWith("IS_")) return;
  if (x.op === "IN" || x.op === "NIN") {
    if (
      !Array.isArray(x.value) ||
      !x.value.every((v) => scalarValid(String(x.field), v))
    )
      errors.push(
        `${path}: membership requires an array of values matching the field type.`,
      );
  } else if (!Object.hasOwn(x, "value") || !scalarValid(x.field, x.value))
    errors.push(`${path}: value does not match ${kind} field ${x.field}.`);
  if (["LT", "LTE", "GT", "GTE"].includes(String(x.op)) && x.value === null)
    errors.push(`${path}: ordering requires a number, not null.`);
}
export function validateRules(input: string): Validation<PolicyRule[]> {
  const errors: string[] = [],
    warnings: string[] = [];
  let data: unknown;
  if (input.length > 200_000)
    return {
      value: null,
      errors: ["Rule input exceeds 200,000 characters."],
      warnings,
    };
  try {
    data = JSON.parse(input);
  } catch {
    return {
      value: null,
      errors: ["Rules must be valid JSON: an array of rule objects."],
      warnings,
    };
  }
  if (!Array.isArray(data) || !data.length || data.length > 100)
    return {
      value: null,
      errors: ["Provide between 1 and 100 rules."],
      warnings,
    };
  const ids = new Set<string>();
  data.forEach((r: unknown, i) => {
    const path = `Rule ${i + 1}`;
    if (!record(r)) {
      errors.push(`${path}: expected an object.`);
      return;
    }
    extras(
      r,
      [
        "id",
        "name",
        "decision",
        "trigger",
        "when",
        "effect",
        "priority",
        "overrides",
        "state_updates",
        "source",
      ],
      path,
      errors,
    );
    for (const key of ["id", "name"])
      if (typeof r[key] !== "string" || !String(r[key]).trim())
        errors.push(`${path}: ${key} is required.`);
    if (typeof r.id === "string") {
      if (ids.has(r.id)) errors.push(`${path}: duplicate ID ${r.id}.`);
      ids.add(r.id);
    }
    if (!["REFUND", "REPLACEMENT"].includes(String(r.decision)))
      errors.push(`${path}: decision must be REFUND or REPLACEMENT.`);
    if (!EVENTS.includes(r.trigger as (typeof EVENTS)[number]))
      errors.push(`${path}: unsupported trigger.`);
    if (r.trigger !== `${r.decision}_REQUESTED`)
      errors.push(
        `${path}: decision rules must trigger on the matching refund or replacement request.`,
      );
    if (!["ALLOW", "DENY"].includes(String(r.effect)))
      errors.push(`${path}: effect must be ALLOW or DENY.`);
    if (r.priority !== undefined && !Number.isSafeInteger(r.priority))
      errors.push(`${path}: priority must be a safe integer.`);
    if (
      r.overrides !== undefined &&
      (!Array.isArray(r.overrides) ||
        !r.overrides.every((id) => typeof id === "string"))
    )
      errors.push(`${path}: overrides must be an array of IDs.`);
    condition(r.when, `${path}.when`, errors, warnings);
    if (!record(r.source)) errors.push(`${path}: source metadata is required.`);
    else {
      extras(
        r.source,
        ["doc_name", "verbatim_sentence"],
        `${path}.source`,
        errors,
      );
      for (const key of ["doc_name", "verbatim_sentence"])
        if (typeof r.source[key] !== "string")
          errors.push(`${path}: source.${key} must be text.`);
      if (!r.source.verbatim_sentence)
        warnings.push(
          `${path}: no source quotation supplied; this is not grounded extraction.`,
        );
    }
    if (r.state_updates !== undefined && r.state_updates !== null) {
      if (!record(r.state_updates))
        errors.push(`${path}: state updates must be an object or null.`);
      else
        Object.entries(r.state_updates).forEach(([field, value]) => {
          if (!Object.hasOwn(FIELD_TYPES, field) || !scalarValid(field, value))
            errors.push(`${path}: invalid state update ${field}.`);
        });
    }
  });
  const objects = data.filter(record);
  objects.forEach((r) => {
    if (Array.isArray(r.overrides)) {
      const seen = new Set();
      r.overrides.forEach((id: unknown) => {
        const target = objects.find((rule) => rule.id === id);
        if (!target || id === r.id || seen.has(id))
          errors.push(
            `Rule ${String(r.id)}: override ${String(id)} is missing, duplicated, or self-referencing.`,
          );
        else if (target.decision !== r.decision || target.trigger !== r.trigger)
          errors.push(
            `Rule ${String(r.id)}: override ${String(id)} must share its decision and trigger.`,
          );
        seen.add(id);
      });
    }
  });
  const visits = new Set<string>(),
    done = new Set<string>();
  function cycle(id: string): boolean {
    if (visits.has(id)) return true;
    if (done.has(id)) return false;
    visits.add(id);
    const r = objects.find((rule) => rule.id === id);
    if (
      Array.isArray(r?.overrides) &&
      r.overrides.some((child) => typeof child === "string" && cycle(child))
    )
      return true;
    visits.delete(id);
    done.add(id);
    return false;
  }
  if (objects.some((r) => typeof r.id === "string" && cycle(r.id)))
    errors.push("Override relationships must not contain a cycle.");
  return {
    value: errors.length
      ? null
      : (objects.map((r) => ({
          ...r,
          priority: r.priority ?? 0,
          overrides: r.overrides ?? [],
          state_updates: r.state_updates ?? null,
        })) as unknown as PolicyRule[]),
    errors,
    warnings,
  };
}
export function validateJourney(input: string): Validation<JourneyEvent[]> {
  const errors: string[] = [],
    warnings: string[] = [];
  let data: unknown;
  if (input.length > 100_000)
    return {
      value: null,
      errors: ["Scenario input exceeds 100,000 characters."],
      warnings,
    };
  try {
    data = JSON.parse(input);
  } catch {
    return {
      value: null,
      errors: ["Scenario must be valid JSON: an array of events."],
      warnings,
    };
  }
  if (!Array.isArray(data) || !data.length || data.length > 50)
    return {
      value: null,
      errors: ["Provide between 1 and 50 events."],
      warnings,
    };
  data.forEach((event: unknown, i) => {
    if (!record(event)) {
      errors.push(`Event ${i + 1}: expected an object.`);
      return;
    }
    extras(event, ["event_type", "day", "payload"], `Event ${i + 1}`, errors);
    if (!EVENTS.includes(event.event_type as (typeof EVENTS)[number]))
      errors.push(`Event ${i + 1}: unsupported event type.`);
    if (!Number.isSafeInteger(event.day) || Number(event.day) < 0)
      errors.push(`Event ${i + 1}: day must be a non-negative safe integer.`);
    if (event.payload !== undefined) {
      if (!record(event.payload))
        errors.push(`Event ${i + 1}: payload must be an object.`);
      else
        Object.entries(event.payload).forEach(([field, value]) => {
          if (!Object.hasOwn(FIELD_TYPES, field) || !scalarValid(field, value))
            errors.push(
              `Event ${i + 1}: invalid payload field/value ${field}.`,
            );
        });
    }
  });
  const events = data as JourneyEvent[];
  if (events.some((event, i) => i > 0 && event?.day < events[i - 1]?.day))
    warnings.push(
      "Events run in ascending day order. Equal-day events retain their input order.",
    );
  if (
    !events.some((e) =>
      ["REFUND_REQUESTED", "REPLACEMENT_REQUESTED"].includes(e?.event_type),
    )
  )
    warnings.push(
      "This journey has no decision request. Events and invariants are still evaluated.",
    );
  return {
    value: errors.length
      ? null
      : events.map((e) => ({ ...e, payload: e.payload ?? {} })),
    errors,
    warnings,
  };
}
export const emptyDraft = (): PolicyDraft => ({
  mode: "demo",
  example: "",
  name: "",
  text: "",
  rulesJson: "[]",
  referenceEdited: false,
});
// A safe editable shape remains available while IDs/values are temporarily invalid.
// Activation always uses validateRules, never this presentation-only parser.
export function editableRules(input: string): PolicyRule[] | null {
  if (input.length > 200_000) return null;
  function shape(x: unknown, depth = 0): boolean {
    if (!record(x) || depth > 8) return false;
    if ("all" in x || "any" in x) {
      const nodes = "all" in x ? x.all : x.any;
      return (
        Array.isArray(nodes) &&
        nodes.length <= 50 &&
        nodes.every((c) => shape(c, depth + 1))
      );
    }
    return (
      typeof x.field === "string" &&
      Object.hasOwn(FIELD_TYPES, x.field) &&
      OPERATORS.includes(x.op as (typeof OPERATORS)[number])
    );
  }
  try {
    const data: unknown = JSON.parse(input);
    if (
      !Array.isArray(data) ||
      data.length > 100 ||
      !data.every(
        (r) =>
          record(r) &&
          ["id", "name", "decision", "trigger", "effect"].every(
            (k) => typeof r[k] === "string",
          ) &&
          shape(r.when) &&
          record(r.source) &&
          typeof r.source.doc_name === "string" &&
          typeof r.source.verbatim_sentence === "string" &&
          (r.overrides === undefined || Array.isArray(r.overrides)),
      )
    )
      return null;
    return data.map((r) => ({
      ...r,
      priority: r.priority ?? 0,
      overrides: r.overrides ?? [],
      state_updates: r.state_updates ?? null,
    })) as PolicyRule[];
  } catch {
    return null;
  }
}
export function demoDraft(
  data: DefaultData,
  example: "v1" | "v2",
): PolicyDraft {
  return {
    mode: "demo",
    example,
    name: `NovaCart ${example}`,
    text: Object.entries(data.documents)
      .map(([name, text]) => `# ${name}\n\n${text}`)
      .join("\n\n"),
    rulesJson: JSON.stringify(
      example === "v1" ? data.rules_v1 : data.rules_v2,
      null,
      2,
    ),
    referenceEdited: false,
  };
}
export function fingerprint(rules: PolicyRule[]): string {
  let hash = 2166136261;
  const text = JSON.stringify(rules);
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0"); // Display only; revision gates requests.
}
export function activateDraft(
  draft: PolicyDraft,
  revision: number,
): Validation<ActivePolicy> {
  const validation = validateRules(draft.rulesJson);
  if (draft.mode === "ai" && (draft.referenceEdited || !draft.compilation))
    validation.errors.push("AI rules require their unchanged compiled source. Recompile explicitly or switch to manual review.");
  if (draft.referenceEdited)
    validation.warnings.push(
      "Reference text was edited; rule conditions and source quotations were not regenerated or verified.",
    );
  if (draft.example === "v2")
    validation.warnings.push(
      "The v2 rule fixture contains revised clauses; the reference document pack is the original NovaCart documents.",
    );
  if (!draft.name.trim()) validation.errors.push("A policy name is required.");
  if (draft.name.length > 120)
    validation.errors.push("Use at most 120 characters for the policy name.");
  if (draft.text.length > 50_000)
    validation.errors.push("Reference policy text exceeds 50,000 characters.");
  return {
    value:
      validation.errors.length || !validation.value
        ? null
        : {
            name: draft.name.trim(),
            origin: draft.mode,
            compilation: draft.mode === "ai" ? draft.compilation : undefined,
            rules: validation.value,
            documents: draft.text,
            fingerprint: fingerprint(validation.value),
            revision,
            warnings: validation.warnings,
          },
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
export function starterRule(index = 1): PolicyRule {
  return {
    id: `manual_refund_${index}`,
    name: "Refund within 30 days",
    decision: "REFUND",
    trigger: "REFUND_REQUESTED",
    when: {
      all: [
        { field: "item_delivered", op: "IS_TRUE", value: true },
        { field: "days_since_delivery", op: "LTE", value: 30 },
      ],
    },
    effect: "ALLOW",
    priority: 0,
    overrides: [],
    state_updates: null,
    source: { doc_name: "Manual rules", verbatim_sentence: "" },
  };
}
