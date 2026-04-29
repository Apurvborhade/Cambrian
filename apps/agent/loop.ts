import { createAgentTask, type CreateAgentTaskOptions } from "../../core/types/task";
import type { AgentGenome } from "../../core/types/genome";
import { createSeedGenomes } from "../../core/genome/generator";
import { ZeroGStorageAdapter } from "../../integrations/0g/storage";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";
import { INFTOnchainAdapter } from "../../integrations/onchain/inft";
import { KeeperHubClient } from "../../integrations/keeperhub/client";
import { UniswapMarketAdapter } from "../../integrations/uniswap/market";
import { UniswapSignalAdapter } from "../../integrations/uniswap/adapter";
import { env } from "../../config/env";
import { Wallet, isHexString } from "ethers";
import { loadAgentMemory, persistAgentMemory } from "./memory";
import { runReasoning } from "./reasoning";
import { finalizeAction } from "./action";
import { calculateFitness } from "../../core/evolution/fitness";

const storage = new ZeroGStorageAdapter();

export interface RunAgentLoopOptions {
  task?: CreateAgentTaskOptions;
}

const createOnchainAdapter = (): INFTOnchainAdapter | null => {
  try {
    return INFTOnchainAdapter.fromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`INFT mint disabled: ${message}`);
    return null;
  }
};

const resolveMintRecipient = (): string | null => {
  const configured = env.inftMintToAddress?.trim();
  if (configured) {
    return configured;
  }

  const key = env.privateKey?.trim();
  if (key && isHexString(key, 32)) {
    return new Wallet(key).address;
  }

  return null;
};

const onchain = createOnchainAdapter();
const mintRecipient = resolveMintRecipient();

const mintGenomeIfEnabled = async (seed: AgentGenome): Promise<string> => {
  if (!onchain) {
    return seed.nft_address;
  }

  if (!mintRecipient) {
    console.warn("INFT mint skipped: missing INFT_MINT_TO_ADDRESS and no valid PRIVATE_KEY.");
    return seed.nft_address;
  }

  const result = await onchain.mint({
    to: mintRecipient,
    genomeId: seed.genome_id,
    parentA: 0n,
    parentB: 0n
  });

  if (result.tokenId === null) {
    return seed.nft_address;
  }

  const contractAddress = env.inftContractAddress?.trim();
  return contractAddress ? `${contractAddress}:${result.tokenId.toString()}` : seed.nft_address;
};

const ensureGenome = async (genomeId: string) => {
  let genome;

  try {
    genome = await storage.getGenome(genomeId);
    console.log("Retrieved genome:", genome, genomeId);
  } catch (error) {
    console.log(error)
    if (error instanceof Error && error.message.toLowerCase().includes("timeout")) {
      throw new Error(
        "Timed out while reading genome from 0G storage. Check RPC/INDEXER/KV endpoint reachability and try again.",
        { cause: error }
      );
    }

    throw error;
  }

  if (!genome) {
    const seed = createSeedGenomes().find((candidate) => candidate.genome_id === genomeId);

    if (seed) {
      await storage.setGenome(seed);

      const nftAddress = await mintGenomeIfEnabled(seed);
      if (nftAddress && nftAddress !== seed.nft_address) {
        genome = {
          ...seed,
          nft_address: nftAddress
        };
        await storage.setGenome(genome);
      } else {
        genome = seed;
      }
    }

    if (!genome) {
      genome = await storage.getGenome(genomeId);
    }

    console.log("Seeded genomes and resolved genome:", genome, genomeId);
  }

  if (!genome) {
    throw new Error(`Unknown genome: ${genomeId}`);
  }

  return genome;
};

const createDefaultTask = (): CreateAgentTaskOptions => ({
  context: {
    poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
    roundWindowBlocks: 20
  }
});

export const runAgentLoop = async (
  genomeId: string,
  providedGenome?: AgentGenome,
  options: RunAgentLoopOptions = {}
) => {
  console.log("Ensuring Genome")
  const genome = providedGenome ?? await ensureGenome(genomeId);
  console.log("Genome", genome)
  console.log("Create Task")
  const task = createAgentTask(options.task ?? createDefaultTask());
  console.log("Task Created")

  const signalAdapter = new UniswapSignalAdapter(new UniswapMarketAdapter());



  const compute = new ZeroGComputeAdapter();


  const keeper = new KeeperHubClient();
  const memory = await loadAgentMemory(storage, genome);
  const signals = await signalAdapter.getSignals(task.context.poolAddress);

  console.log("Signals: ", signals)


  const action = finalizeAction(
    await runReasoning(compute, { genome, task, signals, memory }),
    genome
  );

  const receipt = action.type === "swap" ? await keeper.execute(action) : undefined;
  const fitness = calculateFitness(action, signals);

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

  await persistAgentMemory(storage, genome, { ...memoryRecord, fitness });

  return {
    genomeId,
    task,
    action,
    receipt
  };
};
