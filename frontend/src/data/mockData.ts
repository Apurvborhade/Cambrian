export interface Genome {
  genome_id: string;
  generation: number;
  parent_ids: string[];
  mutation_seed: string;
  mutation_rate_at_birth: number;
  reasoning_strategy: string;
  tool_weights: {
    price_momentum: number;
    volume_signal: number;
    liquidity_depth: number;
    volatility_index: number;
    block_timing: number;
  };
  risk_threshold: number;
  memory_window: number;
  created_at_block: number;
  storage_key: string;
  nft_address: string;
  status: "ALIVE" | "DEAD" | "SELECTED" | "EVOLVED";
  fitness_score: number;
  fitness_history: number[];
}

export interface TournamentState {
  current_generation: number;
  current_round: number;
  rounds_per_generation: number;
  population_size: number;
  survivors: number;
  agents: Genome[];
  generation_fitness_avg: number[];
}

export interface GenerationEvent {
  event_type:
    | "AGENT_BORN"
    | "AGENT_DIED"
    | "FITNESS_UPDATED"
    | "GENERATION_STARTED"
    | "ROUND_COMPLETE";
  agent_id: string;
  generation: number;
  round: number;
  block_number: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export const MOCK_AGENTS: Genome[] = [
  {
    genome_id: "0xgenesis_a",
    generation: 0,
    parent_ids: [],
    mutation_seed: "0xseed_a",
    mutation_rate_at_birth: 0,
    status: "ALIVE",
    reasoning_strategy:
      "Analyze price velocity and volume trends. When momentum is strong and volume confirms, act decisively in the direction of movement. Exit when velocity declines.",
    tool_weights: {
      price_momentum: 0.9,
      volume_signal: 0.8,
      liquidity_depth: 0.3,
      volatility_index: 0.2,
      block_timing: 0.4,
    },
    risk_threshold: 0.25,
    memory_window: 3,
    created_at_block: 1000,
    nft_address: "0xnft_a",
    storage_key: "genomes:0xgenesis_a",
    fitness_score: 4.2,
    fitness_history: [0.8, 1.1, 0.9, 0.7, 0.7],
  },
  {
    genome_id: "0xgenesis_b",
    generation: 0,
    parent_ids: [],
    mutation_seed: "0xseed_b",
    mutation_rate_at_birth: 0,
    status: "ALIVE",
    reasoning_strategy:
      "Assess protocol health: TVL trajectory, fee revenue, user growth, and liquidity depth. Short-term price noise is irrelevant. Act on structural shifts only.",
    tool_weights: {
      price_momentum: 0.3,
      volume_signal: 0.4,
      liquidity_depth: 0.8,
      volatility_index: 0.5,
      block_timing: 0.4,
    },
    risk_threshold: 0.8,
    memory_window: 12,
    created_at_block: 1000,
    nft_address: "0xnft_b",
    storage_key: "genomes:0xgenesis_b",
    fitness_score: 3.9,
    fitness_history: [0.7, 0.8, 0.8, 0.9, 0.7],
  },
  {
    genome_id: "0xgenesis_c",
    generation: 0,
    parent_ids: [],
    mutation_seed: "0xseed_c",
    mutation_rate_at_birth: 0,
    status: "ALIVE",
    reasoning_strategy:
      "Identify overextended moves and mean reversion opportunities. When most signals point one direction, look for evidence the move is exhausted. Be patient.",
    tool_weights: {
      price_momentum: 0.2,
      volume_signal: 0.3,
      liquidity_depth: 0.5,
      volatility_index: 0.9,
      block_timing: 0.6,
    },
    risk_threshold: 0.55,
    memory_window: 7,
    created_at_block: 1000,
    nft_address: "0xnft_c",
    storage_key: "genomes:0xgenesis_c",
    fitness_score: 3.1,
    fitness_history: [0.5, 0.7, 0.6, 0.7, 0.6],
  },
  {
    genome_id: "0xgenesis_d",
    generation: 0,
    parent_ids: [],
    mutation_seed: "0xseed_d",
    mutation_rate_at_birth: 0,
    status: "ALIVE",
    reasoning_strategy:
      "Study historical round patterns stored in memory. Identify recurring sequences and act when current signals match patterns that preceded profitable outcomes.",
    tool_weights: {
      price_momentum: 0.5,
      volume_signal: 0.5,
      liquidity_depth: 0.5,
      volatility_index: 0.5,
      block_timing: 0.5,
    },
    risk_threshold: 0.6,
    memory_window: 20,
    created_at_block: 1000,
    nft_address: "0xnft_d",
    storage_key: "genomes:0xgenesis_d",
    fitness_score: 2.8,
    fitness_history: [0.6, 0.5, 0.6, 0.5, 0.6],
  },
  {
    genome_id: "0xgenesis_e",
    generation: 0,
    parent_ids: [],
    mutation_seed: "0xseed_e",
    mutation_rate_at_birth: 0,
    status: "DEAD",
    reasoning_strategy:
      "Act randomly. Pick a direction at each round without weighting any signal preferentially.",
    tool_weights: {
      price_momentum: 0.48,
      volume_signal: 0.51,
      liquidity_depth: 0.37,
      volatility_index: 0.62,
      block_timing: 0.44,
    },
    risk_threshold: 0.47,
    memory_window: 5,
    created_at_block: 1000,
    nft_address: "0xnft_e",
    storage_key: "genomes:0xgenesis_e",
    fitness_score: 0.9,
    fitness_history: [0.3, 0.1, 0.2, 0.1, 0.2],
  },
  {
    genome_id: "0xbeta_7x",
    generation: 1,
    parent_ids: ["0xgenesis_a", "0xgenesis_b"],
    mutation_seed: "0xblock_hash_gen1",
    mutation_rate_at_birth: 0.3,
    status: "SELECTED",
    reasoning_strategy:
      "Act on momentum when volume confirms and volatility is low. Wait for conviction in the first 5 blocks of any round. Avoid acting immediately after pool events. Assess liquidity depth before committing.",
    tool_weights: {
      price_momentum: 0.85,
      volume_signal: 0.75,
      liquidity_depth: 0.6,
      volatility_index: 0.35,
      block_timing: 0.55,
    },
    risk_threshold: 0.48,
    memory_window: 8,
    created_at_block: 1050,
    nft_address: "0xnft_7x",
    storage_key: "genomes:0xbeta_7x",
    fitness_score: 5.1,
    fitness_history: [1, 1.1, 0.9, 1.1, 1],
  },
];

export const mockTournamentState: TournamentState = {
  current_generation: 1,
  current_round: 3,
  rounds_per_generation: 5,
  population_size: 5,
  survivors: 2,
  agents: MOCK_AGENTS,
  generation_fitness_avg: [2.8, 3.4],
};

export const MOCK_GENERATION_EVENTS: GenerationEvent[] = [
  {
    event_type: "GENERATION_STARTED",
    agent_id: "0xgenesis_a",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:00:00.000Z",
    data: { population_size: 5 },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xgenesis_a",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:01:00.000Z",
    data: { nft_address: "0xnft_a" },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xgenesis_b",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:01:15.000Z",
    data: { nft_address: "0xnft_b" },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xgenesis_c",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:01:30.000Z",
    data: { nft_address: "0xnft_c" },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xgenesis_d",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:01:45.000Z",
    data: { nft_address: "0xnft_d" },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xgenesis_e",
    generation: 0,
    round: 0,
    block_number: 1000,
    timestamp: "2026-04-30T00:02:00.000Z",
    data: { nft_address: "0xnft_e" },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xgenesis_a",
    generation: 0,
    round: 1,
    block_number: 1004,
    timestamp: "2026-04-30T00:10:00.000Z",
    data: { delta: 0.8, score: 0.8 },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xgenesis_b",
    generation: 0,
    round: 1,
    block_number: 1004,
    timestamp: "2026-04-30T00:10:05.000Z",
    data: { delta: 0.7, score: 0.7 },
  },
  {
    event_type: "ROUND_COMPLETE",
    agent_id: "0xgenesis_a",
    generation: 0,
    round: 1,
    block_number: 1005,
    timestamp: "2026-04-30T00:11:00.000Z",
    data: { winner: "0xgenesis_a" },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xgenesis_a",
    generation: 0,
    round: 2,
    block_number: 1010,
    timestamp: "2026-04-30T00:20:00.000Z",
    data: { delta: 1.1, score: 1.9 },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xgenesis_c",
    generation: 0,
    round: 2,
    block_number: 1010,
    timestamp: "2026-04-30T00:20:05.000Z",
    data: { delta: 0.5, score: 0.5 },
  },
  {
    event_type: "ROUND_COMPLETE",
    agent_id: "0xgenesis_c",
    generation: 0,
    round: 2,
    block_number: 1011,
    timestamp: "2026-04-30T00:21:00.000Z",
    data: { winner: "0xgenesis_a" },
  },
  {
    event_type: "AGENT_DIED",
    agent_id: "0xgenesis_e",
    generation: 0,
    round: 3,
    block_number: 1016,
    timestamp: "2026-04-30T00:30:00.000Z",
    data: { reason: "lowest_fitness" },
  },
  {
    event_type: "GENERATION_STARTED",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 0,
    block_number: 1050,
    timestamp: "2026-04-30T01:00:00.000Z",
    data: { parents: ["0xgenesis_a", "0xgenesis_b"] },
  },
  {
    event_type: "AGENT_BORN",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 0,
    block_number: 1050,
    timestamp: "2026-04-30T01:00:15.000Z",
    data: { mutation_rate: 0.3 },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 1,
    block_number: 1054,
    timestamp: "2026-04-30T01:10:00.000Z",
    data: { delta: 1, score: 1 },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 2,
    block_number: 1059,
    timestamp: "2026-04-30T01:20:00.000Z",
    data: { delta: 1.1, score: 2.1 },
  },
  {
    event_type: "ROUND_COMPLETE",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 3,
    block_number: 1064,
    timestamp: "2026-04-30T01:30:00.000Z",
    data: { winner: "0xbeta_7x" },
  },
  {
    event_type: "FITNESS_UPDATED",
    agent_id: "0xgenesis_d",
    generation: 0,
    round: 4,
    block_number: 1019,
    timestamp: "2026-04-30T01:40:00.000Z",
    data: { delta: 0.6, score: 2.8 },
  },
  {
    event_type: "GENERATION_STARTED",
    agent_id: "0xbeta_7x",
    generation: 1,
    round: 0,
    block_number: 1065,
    timestamp: "2026-04-30T02:00:00.000Z",
    data: { population_size: 5 },
  },
];
