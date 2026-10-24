import type { SuiteRequest, SuiteResponse, JourneyEvent } from "./api-types";
import type { ActivePolicy, Scenario } from "./policy-domain";

export type StressInput = {
  suite: "boundary" | "pairwise" | "custom";
  limit: number;
};
export function buildStress(
  input: StressInput,
  active: ActivePolicy | null,
  scenarios: Scenario[],
): { request: SuiteRequest; scope: string } | null {
  if (
    !active ||
    !["boundary", "pairwise", "custom"].includes(input.suite) ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 200 ||
    (input.suite === "custom" && !scenarios.length)
  )
    return null;
  return {
    request: {
      rules: active.rules,
      suite_type: input.suite,
      limit: input.limit,
      default_decision_outcome: "DENY",
      ...(input.suite === "custom" ? { custom_scenarios: scenarios } : {}),
    },
    scope:
      input.suite === "custom"
        ? `${scenarios.length} selected Analyzer demo journeys available; cap ${input.limit}`
        : input.suite === "boundary"
          ? `Boundary journeys generated from active rules; first ${input.limit} available cases`
          : `Fixed-pattern journeys (backend pairwise); first ${input.limit} available cases`,
  };
}
export function signatureBreakdown(
  data: SuiteResponse,
  field: "type" | "severity",
) {
  const counts: Record<string, number> = {};
  for (const { finding } of data.findings)
    counts[finding[field]] = (counts[finding[field]] ?? 0) + 1;
  return Object.entries(counts);
}
/** Presentation alignment only; shrinking preserves event order but may change days. */
export function retainedEvents(
  original: JourneyEvent[],
  reduced: JourneyEvent[],
): boolean[] {
  let next = 0;
  return original.map((event) => {
    const target = reduced[next];
    const match =
      !!target &&
      event.event_type === target.event_type &&
      JSON.stringify(event.payload ?? {}) ===
        JSON.stringify(target.payload ?? {});
    if (match) next++;
    return match;
  });
}
