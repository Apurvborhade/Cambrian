import dotenv from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

dotenv.config();

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.28",
  },
  paths: {
    sources: "src"
  },
  networks: {
    "og-testnet": {
      type: "http",
      chainType: "l1",
      url: process.env.OG_RPC_URL ?? process.env.ZERO_G_RPC_URL ?? process.env.RPC_URL ?? "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
});
