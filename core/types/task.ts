import { randomUUID } from "crypto";

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
  senderPeerId?: string;
  context: TaskContext;
}

export interface CreateAgentTaskOptions {
  id?: string;
  generation?: number;
  round?: number;
  topic?: string;
  issuedAt?: string;
  senderPeerId?: string;
  context: TaskContext;
}

export const createAgentTask = (options: CreateAgentTaskOptions): AgentTask => ({
  id: options.id ?? `task-${randomUUID().slice(0, 8)}`,
  generation: options.generation ?? 0,
  round: options.round ?? 1,
  topic: options.topic ?? "darwin/task",
  issuedAt: options.issuedAt ?? new Date().toISOString(),
  ...(options.senderPeerId ? { senderPeerId: options.senderPeerId } : {}),
  context: options.context
});
