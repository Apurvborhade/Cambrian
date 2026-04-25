export interface ArenaAgentRegistration {
  agentId: string;
  genomeId: string;
  status: "registered" | "active" | "eliminated";
}

export interface ArenaState {
  generation: number;
  round: number;
  running: boolean;
  agents: ArenaAgentRegistration[];
}

export const createInitialArenaState = (): ArenaState => ({
  generation: 0,
  round: 0,
  running: false,
  agents: []
});
