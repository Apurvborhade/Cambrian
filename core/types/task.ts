export interface TaskContext {
  poolAddress: string;
  roundWindowBlocks: number;
  priceReference?: number;
  notes?: string;
}

export interface AgentTask {
  id: string;
  generation: number;
  round: number;
  topic: string;
  issuedAt: string;
  context: TaskContext;
}
