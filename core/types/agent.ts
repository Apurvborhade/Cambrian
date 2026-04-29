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

  // Paper/simulated execution state used for outcome-based fitness without on-chain gas.
  paperPosition?: {
    direction: "long" | "short";
    sizeBps: number;
    entryPrice: number; // decimal-adjusted tokenOut/tokenIn ratio
    entryAt: string; // ISO timestamp
    entryBlockNumber?: number;
  };
  paperPnl?: number; // decimal return, e.g. 0.01 = +1%
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
