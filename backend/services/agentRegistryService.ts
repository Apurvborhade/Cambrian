export interface RegisteredAgent {
  peerId: string;
  genomeId?: string;
  registeredAt: string;
  lastSeenAt: string;
}

class AgentRegistryService {
  private agents = new Map<string, RegisteredAgent>();

  public registerAgent(peerId: string, genomeId?: string): RegisteredAgent {
    const now = new Date().toISOString();
    const existing = this.agents.get(peerId);

    const agent: RegisteredAgent = {
      peerId,
      registeredAt: existing?.registeredAt ?? now,
      lastSeenAt: now
    };

    const resolvedGenomeId = genomeId ?? existing?.genomeId;
    if (resolvedGenomeId) {
      agent.genomeId = resolvedGenomeId;
    }

    this.agents.set(peerId, agent);
    return agent;
  }

  public listAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values()).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
  }

  public getLatestAgent(): RegisteredAgent | null {
    return this.listAgents()[0] ?? null;
  }
}

export const agentRegistryService = new AgentRegistryService();