import type { JourneyEvent } from "./api-types";
/** Mirrors only the documented stable chronological association, never engine decisions. */
export function executionJourney(journey: JourneyEvent[]) {
  return journey
    .map((event, inputIndex) => ({ event, inputIndex }))
    .sort((a, b) => a.event.day - b.event.day || a.inputIndex - b.inputIndex);
}
