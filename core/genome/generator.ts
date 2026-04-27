import type { AgentGenome, ToolWeights } from "../types/genome";
import {
  DEFAULT_MEMORY_WINDOW,
  DEFAULT_MUTATION_RATE,
  DEFAULT_RISK_THRESHOLD
} from "../../config/constants";
import { assertValidGenome } from "./validator";

export interface SeedGenomeInput {
  id: string;
  strategy: string;
  toolWeights: ToolWeights;
  riskThreshold?: number;
  memoryWindow?: number;
}

const buildGenome = (input: SeedGenomeInput, index: number): AgentGenome => {
  const genome: AgentGenome = {
    genome_id: input.id,
    token_id: "",
    nft_contract: "",
    fitness: 0,
    generation: 0,
    parent_ids: [],
    mutation_seed: `seed-${index + 1}`,
    mutation_rate_at_birth: DEFAULT_MUTATION_RATE,
    reasoning_strategy: input.strategy,
    tool_weights: input.toolWeights,
    risk_threshold: input.riskThreshold ?? DEFAULT_RISK_THRESHOLD,
    memory_window: input.memoryWindow ?? DEFAULT_MEMORY_WINDOW,
    created_at_block: 0,
    storage_key: `genomes:${input.id}`,
    nft_address: ""
  };

  return assertValidGenome(genome);
};

export const createSeedGenomes = (): AgentGenome[] => [
  buildGenome(
    {
      id: "genesis-a",
      strategy:
        "You analyze price velocity and volume confirmation. When momentum is strong and the market is expanding quickly, act decisively and exit when the move weakens.",
      toolWeights: {
        price_momentum: 0.9,
        volume_signal: 0.7,
        liquidity_depth: 0.4,
        volatility_index: 0.2,
        block_timing: 0.3
      },
      riskThreshold: 0.35,
      memoryWindow: 3
    },
    0
  ),
  buildGenome(
    {
      id: "genesis-b",
      strategy:
        "You assess protocol health, liquidity, and conviction before taking action. Ignore short bursts of noise and prefer patient, high-confidence decisions.",
      toolWeights: {
        price_momentum: 0.4,
        volume_signal: 0.5,
        liquidity_depth: 0.7,
        volatility_index: 0.4,
        block_timing: 0.5
      },
      riskThreshold: 0.8,
      memoryWindow: 8
    },
    1
  ),
  buildGenome(
    {
      id: "genesis-c",
      strategy:
        "You identify overextended moves and hunt for reversal conditions. Favor volatility and exhaustion signals over trend continuation.",
      toolWeights: {
        price_momentum: 0.2,
        volume_signal: 0.5,
        liquidity_depth: 0.4,
        volatility_index: 0.8,
        block_timing: 0.6
      },
      riskThreshold: 0.55,
      memoryWindow: 6
    },
    2
  ),
  buildGenome(
    {
      id: "genesis-d",
      strategy:
        "You study prior rounds for recurring patterns and only act when the current setup resembles profitable historical sequences with supportive context.",
      toolWeights: {
        price_momentum: 0.5,
        volume_signal: 0.5,
        liquidity_depth: 0.5,
        volatility_index: 0.5,
        block_timing: 0.5
      },
      riskThreshold: 0.65,
      memoryWindow: 20
    },
    3
  ),
  buildGenome(
    {
      id: "genesis-e",
      strategy:
        "You behave as a randomized baseline. You consider signals without a strong prior and act inconsistently enough to serve as a control agent.",
      toolWeights: {
        price_momentum: 0.31,
        volume_signal: 0.76,
        liquidity_depth: 0.12,
        volatility_index: 0.64,
        block_timing: 0.48
      },
      riskThreshold: 0.5,
      memoryWindow: 5
    },
    4
  )
];
