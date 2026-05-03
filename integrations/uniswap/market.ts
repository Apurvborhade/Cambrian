import { env } from "../../config/env";

export interface MarketSnapshot {
  timestamp: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  price: number;
  volume: number;
  liquidity: number;
  volatility: number;
  priceImpact: number;
  blockNumber?: string;
  routeString?: string;
  poolAddressHint?: string;
  error?: {
    status: number;
    errorCode?: string;
    detail?: string;
    requestId?: string;
  };
}

interface QuoteResponse {
  errorCode?: string;
  detail?: string;
  requestId?: string;
  quote?: {
    input?: { amount: string; token: string };
    output?: { amount: string; token: string };
    priceImpact?: number;
    blockNumber?: string;
    routeString?: string;
    route?: Array<
      Array<{
        liquidity?: string;
        tokenIn?: { decimals?: string };
        tokenOut?: { decimals?: string };
      }>
    >;
  };
}

const safeParseNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computePriceRatio = (amountOut: string, amountIn: string): number => {
  const outNum = safeParseNumber(amountOut);
  const inNum = safeParseNumber(amountIn);
  if (outNum <= 0 || inNum <= 0) return 0;
  return outNum / inNum;
};

const computeDecimalAdjustedPrice = (
  amountOut: string,
  amountIn: string,
  tokenOutDecimals: number | null,
  tokenInDecimals: number | null
): number => {
  const raw = computePriceRatio(amountOut, amountIn);
  if (raw === 0) return 0;
  if (tokenOutDecimals === null || tokenInDecimals === null) return raw;

  // price = (out / 10^outDec) / (in / 10^inDec) = raw * 10^(inDec - outDec)
  const exponent = tokenInDecimals - tokenOutDecimals;
  return raw * Math.pow(10, exponent);
};

export class UniswapMarketAdapter {
  public async getMarketSnapshot(poolAddressHint: string): Promise<MarketSnapshot> {
    if (!env.uniswapApiKey) {
      throw new Error("UNISWAP_API_KEY is required to fetch live market snapshots.");
    }

    const tokenIn = env.uniswapTokenIn.trim();
    const tokenOut = env.uniswapTokenOut.trim();
    const amountIn = env.uniswapAmountIn.trim();
    const swapper = env.uniswapSwapper.trim();
    const chainId = env.uniswapChainId;

    if (!tokenIn || !tokenOut || !amountIn || !swapper) {
      throw new Error(
        "Missing Uniswap snapshot env vars. Set UNISWAP_TOKEN_IN, UNISWAP_TOKEN_OUT, UNISWAP_AMOUNT_IN, and UNISWAP_SWAPPER."
      );
    }

    const response = await fetch("https://trade-api.gateway.uniswap.org/v1/quote", {
      method: "POST",
      headers: {
        "x-api-key": env.uniswapApiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        type: "EXACT_INPUT",
        amount: amountIn,
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        tokenIn,
        tokenOut,
        swapper,
        routingPreference: "BEST_PRICE",
        protocols: ["V4", "V3", "V2"]
      })
    });

    if (!response.ok) {
      const bodyText = await response.text();
      let body: QuoteResponse | null = null;

      try {
        body = bodyText ? (JSON.parse(bodyText) as QuoteResponse) : null;
      } catch {
        body = null;
      }

      // The Trading API can return 404 ResourceNotFound when no route/liquidity is available.
      // Don’t crash the whole agent loop; return a zero snapshot and include the error details.
      if (response.status === 404) {
        const errorDetail = body?.detail ?? (bodyText || response.statusText);
        const errorPayload: MarketSnapshot["error"] = {
          status: response.status,
          detail: errorDetail
        };
        if (body?.errorCode) errorPayload.errorCode = body.errorCode;
        if (body?.requestId) errorPayload.requestId = body.requestId;

        const snapshot: MarketSnapshot = {
          timestamp: new Date().toISOString(),
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: "0",
          price: 0,
          volume: 0,
          liquidity: 0,
          volatility: 0,
          priceImpact: 0,
          error: errorPayload
        };

        if (poolAddressHint?.trim()) snapshot.poolAddressHint = poolAddressHint;
        return snapshot;
      }

      throw new Error(
        `Uniswap quote failed (${response.status}): ${bodyText || response.statusText}`
      );
    }

    const data = (await response.json()) as QuoteResponse;
    const quote = data.quote;
    const amountOut = quote?.output?.amount ?? "0";
    const firstHop = quote?.route?.[0]?.[0];
    const liquidityRaw = firstHop?.liquidity ?? "0";
    const tokenInDecimals = firstHop?.tokenIn?.decimals ? Number.parseInt(firstHop.tokenIn.decimals, 10) : null;
    const tokenOutDecimals = firstHop?.tokenOut?.decimals ? Number.parseInt(firstHop.tokenOut.decimals, 10) : null;
    const priceImpact = quote?.priceImpact ?? 0;
    const snapshot: MarketSnapshot = {
      timestamp: new Date().toISOString(),
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      price: computeDecimalAdjustedPrice(amountOut, amountIn, tokenOutDecimals, tokenInDecimals),
      volume: 0,
      liquidity: safeParseNumber(liquidityRaw),
      volatility: priceImpact,
      priceImpact
    };

    if (quote?.blockNumber) snapshot.blockNumber = quote.blockNumber;
    if (quote?.routeString) snapshot.routeString = quote.routeString;
    if (poolAddressHint?.trim()) snapshot.poolAddressHint = poolAddressHint;

    return snapshot;
  }
}
