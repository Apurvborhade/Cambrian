# Uniswap API / Developer Platform Feedback

This repo integrates the Uniswap Trading API at `https://trade-api.gateway.uniswap.org/v1/` for live quote-derived market snapshots.

## What Worked Well

- API key auth was straightforward: using `x-api-key` in headers worked as expected.
- `POST /v1/quote` returns a rich response for swaps:
  - route hops (pool type + liquidity + amounts)
  - `priceImpact`
  - gas estimates
  - a `requestId` for tracing
- Responses are consistent and easy to consume once the request schema is correct (base units, chain IDs, swapper address).

## What Didn’t / Friction We Hit

- The API returns `404 ResourceNotFound` with `"No quotes available"` for unroutable pairs/amounts.
  - This is valid behavior, but in a “market snapshot” use case it’s hard to distinguish:
    - wrong token address vs wrong chain vs no liquidity vs too-small/too-large amount
  - We ended up handling this as a non-fatal “zero snapshot + error details” so the agent runtime can continue.
- The `/v1/quote` endpoint is quote-centric, not snapshot-centric.
  - We want “live market snapshot” data (price, liquidity, maybe volume/volatility) for a pool or token pair.
  - `/v1/quote` can be used as a proxy for price/liquidity, but it requires a swapper + amount which is awkward.
- Volume is not available via `/v1/quote`, so we can’t compute a meaningful `volumeSignal` without another endpoint/data source.

## Docs Gaps / DX Improvements

- A dedicated “market snapshot” endpoint would dramatically simplify integrator usage:
  - input: chainId + tokenIn + tokenOut (or pool id)
  - output: mid price, liquidity depth, recent volume windows, volatility estimate
  - no `swapper` required
  - no base-units `amount` required
- Error responses could be more diagnostic for `No quotes available` cases:
  - explicitly indicate whether token addresses are recognized on that chain
  - explicitly indicate “no route found” vs “route exists but simulation failed”
  - include suggested closest fee tiers / protocols that have liquidity (when applicable)
- Clear “quickstart” examples that show:
  - a known-good token pair per supported chain
  - base unit conversions (especially for common tokens like USDC/USDT/WETH)
  - how to choose a sane default `amount`

## Missing Endpoints We Wish Existed

- `GET /market/snapshot` (pair or pool) as described above.
- Simple reference endpoints:
  - `GET /tokens?chainId=...` (discover token metadata)
  - `GET /pairs?chainId=...&tokenIn=...&tokenOut=...` (discover liquid pairs/fees)
  - `GET /pool/:address` with liquidity and price (without requiring a quote)

## Overall

The `/v1/quote` endpoint is powerful and works reliably for quoting trades, but using it as a “market data feed” introduces avoidable friction (swapper requirement, base units, quote-specific failures). A first-class snapshot endpoint would make agent-style integrations much easier and more robust.
