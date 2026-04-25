export type DarwinEnv = "development" | "test" | "production";

const readEnv = (key: string, fallback = ""): string => process.env[key] ?? fallback;

const readIntEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export interface AppEnv {
  darwinEnv: DarwinEnv;
  zeroGRpcUrl: string;
  zeroGComputeEndpoint: string;
  zeroGApiKey: string;
  zeroGPrivateKey: string;
  axlHost: string;
  axlPort: number;
  keeperHubApiKey: string;
  keeperHubEndpoint: string;
  uniswapApiKey: string;
  targetPoolAddress: string;
  roundsPerGeneration: number;
  populationSize: number;
  survivorsPerGeneration: number;
  deathsPerGeneration: number;
}

export const env: AppEnv = {
  darwinEnv: (readEnv("DARWIN_ENV", "development") as DarwinEnv),
  zeroGRpcUrl: readEnv("ZERO_G_RPC_URL"),
  zeroGComputeEndpoint: readEnv("ZERO_G_COMPUTE_ENDPOINT"),
  zeroGApiKey: readEnv("ZERO_G_API_KEY"),
  zeroGPrivateKey: readEnv("ZERO_G_PRIVATE_KEY"),
  axlHost: readEnv("AXL_HOST", "127.0.0.1"),
  axlPort: readIntEnv("AXL_PORT", 8080),
  keeperHubApiKey: readEnv("KEEPERHUB_API_KEY"),
  keeperHubEndpoint: readEnv("KEEPERHUB_MCP_ENDPOINT"),
  uniswapApiKey: readEnv("UNISWAP_API_KEY"),
  targetPoolAddress: readEnv("TARGET_POOL_ADDRESS"),
  roundsPerGeneration: readIntEnv("ROUNDS_PER_GENERATION", 5),
  populationSize: readIntEnv("POPULATION_SIZE", 5),
  survivorsPerGeneration: readIntEnv("SURVIVORS_PER_GENERATION", 2),
  deathsPerGeneration: readIntEnv("DEATHS_PER_GENERATION", 1)
};
