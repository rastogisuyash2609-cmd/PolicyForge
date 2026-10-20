import type {
  CompileRequest,
  CompileResponse,
  DiffRequest,
  ShrinkRequest,
  SimulateRequest,
  SuiteRequest,
} from "./api-types";
import { createTransport, ApiError, type HttpConfig } from "./http-client";
import {
  defaultDataContract,
  diffContract,
  healthContract,
  shrinkContract,
  simulationContract,
  suiteContract,
} from "./api-contracts";
import { validateJourney, validateRules } from "./policy-domain";
export * from "./api-types";
export { ApiError, API_BASE_URL } from "./http-client";

function requireRules(rules: SimulateRequest["rules"]) {
  const result = validateRules(JSON.stringify(rules));
  if (!result.value) throw new ApiError(result.errors.join(" "), "validation");
}
function requireJourney(journey: SimulateRequest["journey"]) {
  const result = validateJourney(JSON.stringify(journey));
  if (!result.value) throw new ApiError(result.errors.join(" "), "validation");
}
function requireSuite(params: {
  suite_type?: string;
  custom_scenarios?: SuiteRequest["custom_scenarios"];
  limit?: number;
}) {
  if (
    params.suite_type &&
    !["boundary", "pairwise", "custom"].includes(params.suite_type)
  )
    throw new ApiError(
      "This suite is unsupported by the offline client. No fallback suite was run.",
      "validation",
    );
  if (
    params.limit !== undefined &&
    (!Number.isSafeInteger(params.limit) ||
      params.limit < 1 ||
      params.limit > 200)
  )
    throw new ApiError(
      "Scenario limit must be an integer from 1 to 200.",
      "validation",
    );
  if (params.suite_type === "custom") {
    if (
      !params.custom_scenarios?.length ||
      params.custom_scenarios.length > 200
    )
      throw new ApiError(
        "Select 1 to 200 custom scenarios. Empty custom suites are not sent to the backend.",
        "validation",
      );
    const ids = new Set<string>();
    params.custom_scenarios.forEach((scenario) => {
      if (
        !scenario.id?.trim() ||
        !scenario.name?.trim() ||
        ids.has(scenario.id)
      )
        throw new ApiError(
          "Each custom scenario needs a non-empty, unique ID and a name.",
          "validation",
        );
      ids.add(scenario.id);
      requireJourney(scenario.journey);
    });
  }
}
export function createApiClient(config: HttpConfig = {}) {
  const request = createTransport(config);
  return {
    health: (signal?: AbortSignal) =>
      request("/api/health", healthContract, { signal }),
    getDefaultData: (signal?: AbortSignal) =>
      request("/api/default-data", defaultDataContract, { signal }),
    // Prevent accidental provider access through the legacy, unmounted Compiler.
    compile: (_params: CompileRequest): Promise<CompileResponse> =>
      Promise.reject(
        new ApiError(
          "AI compilation is disabled in this offline workspace. Create structured rules or select a known demo.",
          "disabled",
        ),
      ),
    simulate: async (params: SimulateRequest, signal?: AbortSignal) => {
      requireRules(params.rules);
      requireJourney(params.journey);
      return request("/api/simulate", simulationContract, {
        body: params,
        signal,
      });
    },
    runSuite: async (params: SuiteRequest, signal?: AbortSignal) => {
      requireRules(params.rules);
      requireSuite(params);
      return request("/api/run-suite", suiteContract, {
        body: params,
        signal,
        timeoutMs: config.timeoutMs ?? 60_000,
      });
    },
    shrink: async (params: ShrinkRequest, signal?: AbortSignal) => {
      requireRules(params.rules);
      requireJourney(params.journey);
      return request("/api/shrink", shrinkContract, {
        body: params,
        signal,
        timeoutMs: config.timeoutMs ?? 60_000,
      });
    },
    diff: async (params: DiffRequest, signal?: AbortSignal) => {
      requireRules(params.rules_v1);
      requireRules(params.rules_v2);
      requireSuite(params);
      return request("/api/diff", diffContract, {
        body: params,
        signal,
        timeoutMs: config.timeoutMs ?? 60_000,
      });
    },
  };
}
export const api = createApiClient();
