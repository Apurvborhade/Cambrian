import type { AgentSignalSet } from "../../core/types/agent";
import { UniswapMarketAdapter } from "./market";

export class UniswapSignalAdapter {
  constructor(private readonly market: UniswapMarketAdapter) {}

  public async getSignals(poolAddress: string): Promise<AgentSignalSet> {
    const snapshot = await this.market.getMarketSnapshot(poolAddress);

    return {
      priceMomentum: snapshot.price,
      volumeSignal: snapshot.volume,
      liquidityDepth: snapshot.liquidity,
      volatilityIndex: snapshot.volatility,
      blockTiming: 0.5
    };
  }
}
