import type { GenerationFitnessSummary } from "../types/fitness";

export interface SelectionResult {
  survivors: string[];
  eliminated: string[];
}

export const selectAgents = (
  summary: GenerationFitnessSummary,
  survivorsCount: number,
  eliminatedCount: number
): SelectionResult => {
  const ordered = [...summary.rankings].sort((left, right) => right.totalScore - left.totalScore);

  return {
    survivors: ordered.slice(0, survivorsCount).map((entry) => entry.agentId),
    eliminated: ordered.slice(-eliminatedCount).map((entry) => entry.agentId)
  };
};
