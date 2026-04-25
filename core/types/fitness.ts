export interface RoundFitness {
  agentId: string;
  round: number;
  generation: number;
  score: number;
  confidenceBonus: number;
  speedBonus: number;
  inactionPenalty: number;
}

export interface GenerationFitnessSummary {
  generation: number;
  rankings: Array<{
    agentId: string;
    totalScore: number;
  }>;
}
