export interface NetworkConfig {
  name: string;
  chainId?: number;
  rpcUrl: string;
}

export interface NetworksConfig {
  zeroG: NetworkConfig;
  axl: {
    host: string;
    port: number;
  };
}

export const networks: NetworksConfig = {
  zeroG: {
    name: "0g-testnet",
    rpcUrl: process.env.ZERO_G_RPC_URL ?? ""
  },
  axl: {
    host: process.env.AXL_HOST ?? "127.0.0.1",
    port: Number.parseInt(process.env.AXL_PORT ?? "8080", 10)
  }
};
