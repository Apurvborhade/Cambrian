import type { AgentAction, AgentMemoryRecord } from "../types/agent";
import { env } from "../../config/env";
import type { MarketSnapshot } from "../../integrations/uniswap/market";

export interface PaperFitnessResult {
  score: number;
  pnl: number;
  outcome: "win" | "loss" | "flat";
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseBlockNumber = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const mostRecentOpenPaperPosition = (
  memory: AgentMemoryRecord[]
): NonNullable<AgentMemoryRecord["paperPosition"]> | null => {
  for (let idx = memory.length - 1; idx >= 0; idx -= 1) {
    const record = memory[idx];
    if (record?.paperPosition) {
      return record.paperPosition;
    }
  }
  return null;
};

const isPositionDue = (position: NonNullable<AgentMemoryRecord["paperPosition"]>, snapshot: MarketSnapshot): boolean => {
  const evalBlocks = env.fitnessEvalBlocks ?? 0;
  const snapshotBlock = parseBlockNumber(snapshot.blockNumber);
  if (evalBlocks > 0 && position.entryBlockNumber && snapshotBlock) {
    return snapshotBlock - position.entryBlockNumber >= evalBlocks;
  }

  const evalMinutes = env.fitnessEvalMinutes ?? 5;
  const entryMs = Date.parse(position.entryAt);
  if (!Number.isFinite(entryMs)) return false;
  const elapsedMs = Date.now() - entryMs;
  return elapsedMs >= evalMinutes * 60_000;
};

export const paperPositionFromAction = (
  action: AgentAction,
  snapshot: MarketSnapshot
): AgentMemoryRecord["paperPosition"] | null => {
  const sizeBps = typeof action.sizeBps === "number" ? action.sizeBps : 0;
  if (action.type !== "swap") return null;
  if (action.direction !== "long" && action.direction !== "short") return null;
  if (sizeBps <= 0) return null;
  if (!Number.isFinite(snapshot.price) || snapshot.price <= 0) return null;

  const entryBlock = parseBlockNumber(snapshot.blockNumber);
  return {
    direction: action.direction,
    sizeBps,
    entryPrice: snapshot.price,
    entryAt: snapshot.timestamp,
    ...(entryBlock ? { entryBlockNumber: entryBlock } : {})
  };
};

export const computePaperFitnessIfDue = (
  memory: AgentMemoryRecord[],
  snapshot: MarketSnapshot
): PaperFitnessResult | null => {
  const position = mostRecentOpenPaperPosition(memory);
  if (!position) return null;
  if (!isPositionDue(position, snapshot)) return null;
  if (!Number.isFinite(snapshot.price) || snapshot.price <= 0) return null;

  const rawPnl =
    position.direction === "long"
      ? (snapshot.price - position.entryPrice) / position.entryPrice
      : (position.entryPrice - snapshot.price) / position.entryPrice;

  // Scale returns into a roughly [-2, 2] range for selection stability.
  // Example: +1% return => score ~= +1.0
  const score = clamp(rawPnl * 100, -2, 2);
  const outcome: PaperFitnessResult["outcome"] =
    rawPnl > 0 ? "win" : rawPnl < 0 ? "loss" : "flat";

  return { score, pnl: rawPnl, outcome };
};

