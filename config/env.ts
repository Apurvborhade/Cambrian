import dotenv from "dotenv";

dotenv.config();

export const env = {
  RPC_URL: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
  INDEXER_RPC: process.env.INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai",
  KV_RPC_URL: process.env.KV_RPC_URL || "https://evmrpc-testnet.0g.ai",
  KV_GENOME_STREAM_ID: process.env.KV_GENOME_STREAM_ID || "",
  privateKey: process.env.PRIVATE_KEY,
  zeroGComputeProviderAddress: process.env.ZG_COMPUTE_PROVIDER_ADDRESS || "",
  zeroGComputeModel: process.env.ZG_COMPUTE_MODEL || "",
  populationSize: parseInt(process.env.POPULATION_SIZE ?? "10", 10),
  roundsPerGeneration: parseInt(process.env.ROUNDS_PER_GENERATION ?? "5", 10),
  survivorsPerGeneration: parseInt(process.env.SURVIVORS_PER_GENERATION ?? "2", 10),
  deathsPerGeneration: parseInt(process.env.DEATHS_PER_GENERATION ?? "1", 10),
  targetPoolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool"
  
};
