import type { RoundFitness } from "../../core/types/fitness";
import type { ExecutionReceipt } from "../../integrations/keeperhub/client";

export const computeRoundFitness = (
  agentId: string,
  generation: number,
  round: number,
  receipt?: ExecutionReceipt
): RoundFitness => {
  if (!receipt) {
    return {
      agentId,
      generation,
      round,
      score: -0.3,
      confidenceBonus: 0,
      speedBonus: 0,
      inactionPenalty: -0.3
    };
  }

  const confidenceBonus = receipt.action.confidence >= 0.8 ? 0.5 : 0;

  return {
    agentId,
    generation,
    round,
    score: 1 + confidenceBonus,
    confidenceBonus,
    speedBonus: 0,
    inactionPenalty: 0
  };
};
