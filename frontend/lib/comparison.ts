import type { DefaultData, DiffRequest, PolicyRule } from "./api-types";
import {
  validateJourney,
  validateRules,
  type ActivePolicy,
} from "./policy-domain";
export type RuleSnapshot = {
  name: string;
  origin: "demo" | "manual";
  revision: number;
  fingerprint: string;
  rules: PolicyRule[];
};
export type RuleIdentity = {
  label: string;
  origin: string;
  revision: number | null;
  fingerprint?: string;
};
export type ComparisonInput = {
  baseline: string;
  candidate: string;
  suite: "demo" | "current" | "boundary" | "pairwise";
  limit: number;
};
export const emptyComparison = (): ComparisonInput => ({
  baseline: "",
  candidate: "",
  suite: "demo",
  limit: 20,
});
export function capturePolicy(active: ActivePolicy): RuleSnapshot {
  return {
    name: active.name,
    origin: active.origin,
    revision: active.revision,
    fingerprint: active.fingerprint,
    rules: JSON.parse(JSON.stringify(active.rules)) as PolicyRule[],
  };
}
export function buildComparison(
  input: ComparisonInput,
  data: DefaultData | null,
  snapshot: RuleSnapshot | null,
  scenarioJson: string,
  scenarioName: string,
): {
  request: DiffRequest;
  baselineLabel: string;
  candidateLabel: string;
  scopeLabel: string;
  identities: [RuleIdentity, RuleIdentity];
} | null {
  if (
    !data ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 200
  )
    return null;
  const choose = (id: string) =>
    id === "v1"
      ? {
          rules: data.rules_v1,
          label: "NovaCart v1 · demo fixture",
          origin: "Repository demo fixture",
          revision: null,
        }
      : id === "v2"
        ? {
            rules: data.rules_v2,
            label: "NovaCart v2 · demo fixture",
            origin: "Repository demo fixture",
            revision: null,
          }
        : id === "snapshot" && snapshot
          ? {
              rules: snapshot.rules,
              label: `${snapshot.name} · ${snapshot.origin} snapshot · rev ${snapshot.revision} · ${snapshot.fingerprint}`,
              origin: `${snapshot.origin} captured snapshot`,
              revision: snapshot.revision,
              fingerprint: snapshot.fingerprint,
            }
          : null;
  const a = choose(input.baseline),
    b = choose(input.candidate);
  if (
    !a ||
    !b ||
    !validateRules(JSON.stringify(a.rules)).value ||
    !validateRules(JSON.stringify(b.rules)).value
  )
    return null;
  let request: DiffRequest = {
      rules_v1: a.rules,
      rules_v2: b.rules,
      limit: input.limit,
      suite_type: "custom",
    },
    scopeLabel: string;
  if (input.suite === "demo") {
    if (!data.sample_journeys.length) return null;
    request.custom_scenarios = data.sample_journeys;
    scopeLabel = `${data.sample_journeys.length} known demo journeys available; cap ${input.limit}`;
  } else if (input.suite === "current") {
    const journey = validateJourney(scenarioJson);
    if (!journey.value) return null;
    request.custom_scenarios = [
      {
        id: "edited_journey",
        name: scenarioName.trim() || "Edited journey",
        description: "Current explicitly edited Analyzer journey",
        journey: journey.value,
      },
    ];
    scopeLabel = `One current Analyzer journey; cap ${input.limit}`;
  } else {
    request = { ...request, suite_type: input.suite };
    scopeLabel =
      input.suite === "boundary"
        ? `First ${input.limit} boundary journeys generated from baseline rules only`
        : `First ${input.limit} fixed-pattern journeys (backend “pairwise” suite)`;
  }
  return {
    request,
    baselineLabel: a.label,
    candidateLabel: b.label,
    scopeLabel,
    identities: [a, b].map(({ rules, ...identity }) => identity) as [
      RuleIdentity,
      RuleIdentity,
    ],
  };
}
