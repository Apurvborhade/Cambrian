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
  event_type: string;
  agent_id: string;
  generation: number;
  round: number;
  block_number: number;
  timestamp: string;
  data: Record<string, unknown>;
}
