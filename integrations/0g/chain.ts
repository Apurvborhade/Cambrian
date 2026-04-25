export interface AgentRegistrationRecord {
  genomeId: string;
  parentIds: string[];
  nftAddress: string;
}

export class ZeroGChainAdapter {
  private readonly registrations = new Map<string, AgentRegistrationRecord>();

  public async registerGenome(record: AgentRegistrationRecord): Promise<void> {
    this.registrations.set(record.genomeId, record);
  }

  public async getRegistration(genomeId: string): Promise<AgentRegistrationRecord | undefined> {
    return this.registrations.get(genomeId);
  }
}
