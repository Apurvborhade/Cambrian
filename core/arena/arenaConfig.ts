import { env } from "../../config/env";

export interface ArenaConfig {
  populationSize: number;
  roundsPerGeneration: number;
  survivorsPerGeneration: number;
  deathsPerGeneration: number;
  targetPoolAddress: string;
}

export const createArenaConfig = (): ArenaConfig => ({
  populationSize: env.populationSize,
  roundsPerGeneration: env.roundsPerGeneration,
  survivorsPerGeneration: env.survivorsPerGeneration,
  deathsPerGeneration: env.deathsPerGeneration,
  targetPoolAddress: env.targetPoolAddress
});
