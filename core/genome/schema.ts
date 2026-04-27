import type { AgentGenome, ToolWeights } from "../types/genome";
import { DARWIN_PROTOCOL_SCHEMA } from "../../config/constants";

export interface GenomeSchemaDescriptor {
  $schema: string;
  version: "v1";
  requiredFields: Array<keyof AgentGenome>;
  numericWeightKeys: Array<keyof ToolWeights>;
}

export const genomeSchema: GenomeSchemaDescriptor = {
  $schema: DARWIN_PROTOCOL_SCHEMA,
  version: "v1",
  requiredFields: [
    "genome_id",
    "token_id",
    "nft_contract",
    "fitness",
    "generation",
    "parent_ids",
    "mutation_seed",
    "mutation_rate_at_birth",
    "reasoning_strategy",
    "tool_weights",
    "risk_threshold",
    "memory_window",
    "created_at_block",
    "storage_key",
    "nft_address"
  ],
  numericWeightKeys: [
    "price_momentum",
    "volume_signal",
    "liquidity_depth",
    "volatility_index",
    "block_timing"
  ]
};
