import dotenv from "dotenv";

dotenv.config();

export const env = {
  RPC_URL: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
  INDEXER_RPC: process.env.INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai",
  KV_RPC_URL: process.env.KV_RPC_URL || "http://127.0.0.1:6789",
  KV_GENOME_STREAM_ID: process.env.KV_GENOME_STREAM_ID || "",
  privateKey: process.env.PRIVATE_KEY || "",
  zeroGComputeLedgerAddress: process.env.ZG_COMPUTE_LEDGER_ADDRESS || "",
  zeroGComputeInferenceAddress: process.env.ZG_COMPUTE_INFERENCE_ADDRESS || "",
  zeroGComputeFineTuningAddress: process.env.ZG_COMPUTE_FINE_TUNING_ADDRESS || "",
  zeroGComputeProviderAddress: process.env.ZG_COMPUTE_PROVIDER_ADDRESS || "",
  inftContractAddress: process.env.INFT_CONTRACT_ADDRESS || "",
  inftMintToAddress: process.env.INFT_MINT_TO_ADDRESS || "",
  zeroGComputeProviderFundOg: parseFloat(process.env.ZG_COMPUTE_PROVIDER_FUND_OG ?? "1"),
  zeroGComputeAutoDeposit: process.env.ZG_COMPUTE_AUTO_DEPOSIT === "true",
  zeroGComputeAutoTransfer: process.env.ZG_COMPUTE_AUTO_TRANSFER === "true",
  zeroGComputeLedgerDepositOg: parseFloat(process.env.ZG_COMPUTE_LEDGER_DEPOSIT_OG ?? "3"),
  zeroGComputeModel: process.env.ZG_COMPUTE_MODEL || "",
  populationSize: parseInt(process.env.POPULATION_SIZE ?? "10", 10),
  roundsPerGeneration: parseInt(process.env.ROUNDS_PER_GENERATION ?? "5", 10),
  survivorsPerGeneration: parseInt(process.env.SURVIVORS_PER_GENERATION ?? "2", 10),
  deathsPerGeneration: parseInt(process.env.DEATHS_PER_GENERATION ?? "1", 10),
  arenaBurnsPerGeneration: parseInt(process.env.ARENA_BURNS_PER_GENERATION ?? "2", 10),
  uniswapApiKey: process.env.UNISWAP_API_KEY ?? "",
  uniswapChainId: parseInt(process.env.UNISWAP_CHAIN_ID ?? "1", 10),
  uniswapTokenIn: process.env.UNISWAP_TOKEN_IN ?? "",
  uniswapTokenOut: process.env.UNISWAP_TOKEN_OUT ?? "",
  uniswapAmountIn: process.env.UNISWAP_AMOUNT_IN ?? "",
  uniswapSwapper: process.env.UNISWAP_SWAPPER ?? "",
  targetPoolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",

  // Outcome-based (paper) fitness evaluation window.
  // If both are set, blocks takes precedence when quote block numbers are available.
  fitnessEvalBlocks: process.env.FITNESS_EVAL_BLOCKS ? parseInt(process.env.FITNESS_EVAL_BLOCKS, 10) : 0,
  fitnessEvalMinutes: process.env.FITNESS_EVAL_MINUTES ? parseFloat(process.env.FITNESS_EVAL_MINUTES) : 5
  
};
