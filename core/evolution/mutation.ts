import type { AgentGenome } from "../types/genome";
import { DEFAULT_MUTATION_RATE } from "../../config/constants";
import { assertValidGenome } from "../genome/validator";

export interface MutationRequest {
  parentA: AgentGenome;
  parentB: AgentGenome;
  mutationSeed: string;
  mutationRate?: number;
}

export const buildCrossoverPrompt = (request: MutationRequest): string => {
  const rate = request.mutationRate ?? DEFAULT_MUTATION_RATE;

  return [
    "You are a genome crossover engine.",
    "Blend the reasoning strategies coherently and mutate numeric parameters carefully.",
    `Mutation seed: ${request.mutationSeed}`,
    `Mutation rate: ${rate}`,
    `Parent A: ${JSON.stringify(request.parentA)}`,
    `Parent B: ${JSON.stringify(request.parentB)}`,
    "Return valid Darwin genome JSON only."
  ].join("\n");
};

export const normalizeChildGenome = (
  child: AgentGenome,
  request: MutationRequest
): AgentGenome => {
  const normalized: AgentGenome = {
    ...child,
    generation: Math.max(request.parentA.generation, request.parentB.generation) + 1,
    parent_ids: [request.parentA.genome_id, request.parentB.genome_id],
    mutation_seed: request.mutationSeed,
    mutation_rate_at_birth: request.mutationRate ?? DEFAULT_MUTATION_RATE,
    storage_key: `genomes:${child.genome_id}`
  };

  return assertValidGenome(normalized);
};
