import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";
import { ZeroGStorageAdapter } from "../../integrations/0g/storage";

export const loadAgentMemory = async (
  storage: ZeroGStorageAdapter,
  genome: AgentGenome
): Promise<AgentMemoryRecord[]> => storage.getRecentMemory(genome.genome_id, genome.memory_window);

export const persistAgentMemory = async (
  storage: ZeroGStorageAdapter,
  genome: AgentGenome,
  record: AgentMemoryRecord
): Promise<void> => {
  await storage.appendMemory(genome.genome_id, record);
};
