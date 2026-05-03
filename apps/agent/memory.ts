import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";
import type { StorageAdapter } from "../../integrations/storage";

export const loadAgentMemory = async (
  storage: StorageAdapter,
  genome: AgentGenome | any
): Promise<AgentMemoryRecord[]> => storage.getRecentMemory(genome.genome_id, genome.memory_window);

export const persistAgentMemory = async (
  storage: StorageAdapter,
  genome: AgentGenome | any,
  record: AgentMemoryRecord
): Promise<void> => {
  await storage.appendMemory(genome.genome_id, record);
};
