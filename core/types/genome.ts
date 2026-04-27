export interface ToolWeights {
  price_momentum: number;
  volume_signal: number;
  liquidity_depth: number;
  volatility_index: number;
  block_timing: number;
}

export interface AgentGenome {
  genome_id: string;
  token_id: string;
  nft_contract: string;
  fitness: number;
  generation: number;
  parent_ids: string[];
  mutation_seed: string;
  mutation_rate_at_birth: number;
  reasoning_strategy: string;
  tool_weights: ToolWeights;
  risk_threshold: number;
  memory_window: number;
  created_at_block: number;
  storage_key: string;
  nft_address: string;
}
