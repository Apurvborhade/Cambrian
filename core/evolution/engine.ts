import type { GenerationFitnessSummary } from "../types/fitness";
import { selectAgents, type SelectionResult } from "./selection";

export interface GenerationTransition {
  generation: number;
  selection: SelectionResult;
}

export const runGeneration = (
  generation: number,
  summary: GenerationFitnessSummary,
  survivorsCount: number,
  eliminatedCount: number
): GenerationTransition => ({
  generation,
  selection: selectAgents(summary, survivorsCount, eliminatedCount)
});
