import { Value } from "@0gfoundation/0g-ts-sdk";
import type { AgentGenome } from "./genome";
import type { AgentTask } from "./task";

export interface AgentSignalSet {
  priceMomentum: number;
  volumeSignal: number;
  liquidityDepth: number;
  volatilityIndex: number;
  blockTiming: number;
}

export interface AgentAction {
  type: "swap" | "hold" | "observe";
  direction: "long" | "short" | "flat";
  confidence: number;
  rationale: string;
  sizeBps?: number;
}

export interface AgentMemoryRecord {
  round: number;
  summary: string;
  outcome?: "win" | "loss" | "flat";
  action?: AgentAction;
  fitness:number;
}

export interface AgentContext {
  genome: AgentGenome | any;
  task: AgentTask;
  signals: AgentSignalSet;
  memory: AgentMemoryRecord[];
}

export interface AgentRuntimeState {
  agentId: string;
  genomeId: string;
  currentRound: number;
  status: "idle" | "running" | "stopped";
  lastTaskAt?: string;
}
