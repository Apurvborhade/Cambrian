import { EventEmitter } from "node:events";
import type { AgentAction } from "../types/agent";
import type { AgentGenome } from "../types/genome";
import type { ArenaRoundResult, ArenaStateView } from "./arena";

export type ArenaEventType =
  | "arena.created"
  | "arena.state.updated"
  | "arena.round.started"
  | "arena.round.completed"
  | "arena.agent.evaluated"
  | "arena.child.planned"
  | "arena.child.created"
  | "arena.genome.minted"
  | "arena.genome.reused"
  | "arena.genome.burned";

export interface ArenaEventMap {
  "arena.created": {
    state: ArenaStateView;
    agents: AgentGenome[];
  };
  "arena.state.updated": {
    state: ArenaStateView;
  };
  "arena.round.started": {
    generation: number;
    round: number;
    genomeIds: string[];
  };
  "arena.round.completed": {
    result: ArenaRoundResult;
  };
  "arena.agent.evaluated": {
    genome: AgentGenome;
    action: AgentAction;
    fitness: number;
    generation: number;
    round: number;
  };
  "arena.child.planned": {
    generation: number;
    parents: {
      best: AgentGenome;
      second: AgentGenome;
    };
  };
  "arena.child.created": {
    generation: number;
    child: AgentGenome;
    parents: {
      best: AgentGenome;
      second: AgentGenome;
    };
  };
  "arena.genome.minted": {
    genome: AgentGenome;
    source: "seed" | "child";
  };
  "arena.genome.reused": {
    genome: AgentGenome;
    source: "existing";
  };
  "arena.genome.burned": {
    genome: AgentGenome;
    tokenId: string;
    txHash: string;
  };
}

export interface ArenaEvent<Type extends ArenaEventType = ArenaEventType> {
  type: Type;
  arenaId: string;
  timestamp: string;
  data: ArenaEventMap[Type];
}

type ArenaEventListener = (event: ArenaEvent) => void;

const emitter = new EventEmitter();
const CHANNEL = "arena:event";

emitter.setMaxListeners(0);

export const emitArenaEvent = <Type extends ArenaEventType>(event: ArenaEvent<Type>): void => {
  emitter.emit(CHANNEL, event);
};

export const subscribeArenaEvents = (arenaId: string, listener: ArenaEventListener): (() => void) => {
  const handler: ArenaEventListener = (event) => {
    if (event.arenaId === arenaId) {
      listener(event);
    }
  };

  emitter.on(CHANNEL, handler);

  return () => {
    emitter.off(CHANNEL, handler);
  };
};