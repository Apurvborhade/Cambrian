import {
  arenaExists,
  createArena,
  getArenaAgents,
  getArenaDetails,
  getArenaState,
  runArena,
  runArenaRound,
  type ArenaDetails,
  type ArenaStateView
} from "../../core/arena/arena";
import type { AgentGenome } from "../../core/types/genome";

export interface CreateArenaResult {
  arenaId: string;
  created: boolean;
  size: number;
  state: ArenaStateView | null;
  agents: AgentGenome[];
}

const createArenaRecord = async (arenaId: string, size: number): Promise<CreateArenaResult> => {
  const exists = await arenaExists(arenaId);
  const agents = exists ? await getArenaAgents(arenaId) : await createArena(arenaId, size);
  const details = (await getArenaDetails(arenaId)) as ArenaDetails | null;

  return {
    arenaId,
    created: !exists,
    size,
    state: details?.state ?? null,
    agents
  };
};

export const arenaService = {
  createArena: createArenaRecord,
  getArena: getArenaDetails,
  getArenaState,
  getArenaAgents,
  runArenaRound,
  runArena
};