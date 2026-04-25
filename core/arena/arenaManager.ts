import type { ArenaConfig } from "./arenaConfig";
import type { ArenaState, ArenaAgentRegistration } from "./arenaState";
import { createInitialArenaState } from "./arenaState";

export class ArenaManager {
  private readonly state: ArenaState;

  constructor(private readonly config: ArenaConfig) {
    this.state = createInitialArenaState();
  }

  public start(): ArenaState {
    this.state.running = true;
    return this.snapshot();
  }

  public stop(): ArenaState {
    this.state.running = false;
    return this.snapshot();
  }

  public advanceRound(): ArenaState {
    if (!this.state.running) {
      throw new Error("Arena must be running before rounds can advance.");
    }

    this.state.round += 1;

    if (this.state.round > this.config.roundsPerGeneration) {
      this.state.generation += 1;
      this.state.round = 1;
    }

    return this.snapshot();
  }

  public registerAgent(registration: ArenaAgentRegistration): ArenaState {
    this.state.agents.push(registration);
    return this.snapshot();
  }

  public snapshot(): ArenaState {
    return {
      generation: this.state.generation,
      round: this.state.round,
      running: this.state.running,
      agents: [...this.state.agents]
    };
  }
}
