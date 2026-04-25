import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";

export class ZeroGStorageAdapter {
  private readonly genomes = new Map<string, AgentGenome>();
  private readonly memory = new Map<string, AgentMemoryRecord[]>();

  public async setGenome(genome: AgentGenome): Promise<void> {
    this.genomes.set(genome.genome_id, genome);
  }

  public async getGenome(genomeId: string): Promise<AgentGenome | undefined> {
    return this.genomes.get(genomeId);
  }

  public async appendMemory(genomeId: string, record: AgentMemoryRecord): Promise<void> {
    const existing = this.memory.get(genomeId) ?? [];
    existing.push(record);
    this.memory.set(genomeId, existing);
  }

  public async getRecentMemory(genomeId: string, window: number): Promise<AgentMemoryRecord[]> {
    const existing = this.memory.get(genomeId) ?? [];
    return existing.slice(-window);
  }
}
