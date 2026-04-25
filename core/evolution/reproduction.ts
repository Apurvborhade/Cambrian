import type { AgentGenome } from "../types/genome";
import type { MutationRequest } from "./mutation";
import { normalizeChildGenome } from "./mutation";

export interface MutationAdapter {
  crossover(request: MutationRequest): Promise<AgentGenome>;
}

export const reproduceGenome = async (
  request: MutationRequest,
  mutationAdapter: MutationAdapter
): Promise<AgentGenome> => {
  const rawChild = await mutationAdapter.crossover(request);
  return normalizeChildGenome(rawChild, request);
};
