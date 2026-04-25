import type { AgentTask } from "../../core/types/task";
import { createSeedGenomes } from "../../core/genome/generator";
import { ZeroGStorageAdapter } from "../../integrations/0g/storage";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";
import { KeeperHubClient } from "../../integrations/keeperhub/client";
import { UniswapMarketAdapter } from "../../integrations/uniswap/market";
import { UniswapSignalAdapter } from "../../integrations/uniswap/adapter";
import { loadAgentMemory, persistAgentMemory } from "./memory";
import { runReasoning } from "./reasoning";
import { finalizeAction } from "./action";

const storage = new ZeroGStorageAdapter();

const ensureGenome = async (genomeId: string) => {
  let genome = await storage.getGenome(genomeId);

  if (!genome) {
    for (const seed of createSeedGenomes()) {
      await storage.setGenome(seed);
    }
    genome = await storage.getGenome(genomeId);
  }

  if (!genome) {
    throw new Error(`Unknown genome: ${genomeId}`);
  }

  return genome;
};

const createTask = (): AgentTask => ({
  id: "local-task-1",
  generation: 0,
  round: 1,
  topic: "darwin/task",
  issuedAt: new Date().toISOString(),
  context: {
    poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
    roundWindowBlocks: 20
  }
});

export const runAgentLoop = async (genomeId: string) => {
  const genome = await ensureGenome(genomeId);
  const task = createTask();
  const signalAdapter = new UniswapSignalAdapter(new UniswapMarketAdapter());
  const compute = new ZeroGComputeAdapter();
  const keeper = new KeeperHubClient();
  const memory = await loadAgentMemory(storage, genome);
  const signals = await signalAdapter.getSignals(task.context.poolAddress);
  const action = finalizeAction(
    await runReasoning(compute, { genome, task, signals, memory }),
    genome
  );

  const receipt = action.type === "swap" ? await keeper.execute(action) : undefined;

  const memoryRecord =
    action.type === "swap"
      ? {
          round: task.round,
          summary: action.rationale,
          outcome: "flat" as const,
          action
        }
      : {
          round: task.round,
          summary: action.rationale,
          action
        };

  await persistAgentMemory(storage, genome, memoryRecord);

  return {
    genomeId,
    task,
    action,
    receipt
  };
};
