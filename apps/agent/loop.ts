import { createAgentTask, type CreateAgentTaskOptions, type AgentTask } from "../../core/types/task";
import type { AgentGenome } from "../../core/types/genome";
import { createSeedGenomes } from "../../core/genome/generator";
import { createStorageAdapter } from "../../integrations/storage";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";
import { INFTOnchainAdapter } from "../../integrations/onchain/inft";
import { KeeperHubClient, type ExecutionReceipt } from "../../integrations/keeperhub/client";
import { UniswapMarketAdapter } from "../../integrations/uniswap/market";
import type { AgentSignalSet } from "../../core/types/agent";
import { env } from "../../config/env";
import { Wallet, isHexString } from "ethers";
import { loadAgentMemory, persistAgentMemory } from "./memory";
import { runReasoning } from "./reasoning";
import { finalizeAction } from "./action";
import { calculateFitness } from "../../core/evolution/fitness";
import { axlSubscriber } from "../../integrations/axl/subscriber";
import { axlBroadcaster } from "../../integrations/axl/broadcaster";
import { axlClient } from "../../integrations/axl/axlClient";
import fs from "fs";
import os from "os";
import { computePaperFitnessIfDue, paperPositionFromAction } from "../../core/evolution/paperFitness";
import type { MarketSnapshot } from "../../integrations/uniswap/market";

const storage = createStorageAdapter();

export interface RunAgentLoopOptions {
  task?: CreateAgentTaskOptions;
}

export interface RunAgentLoopResult {
  genomeId: string;
  task: ReturnType<typeof createAgentTask>;
  action: Awaited<ReturnType<typeof runReasoning>>;
  receipt?: ExecutionReceipt;
  fitness: number;
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

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`INFT mint failed for ${seed.genome_id}, continuing without NFT mint: ${message}`);
    return seed.nft_address;
  }
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

const registerAgentWithBackend = async (peerId: string, genomeId: string): Promise<void> => {
  const resolveBackendUrl = (): string => {
    const explicit = process.env.BACKEND_URL?.trim();
    if (explicit) {
      return explicit;
    }

    const backendPort = process.env.BACKEND_PORT ?? "3001";

    if (os.platform() === "linux" && os.release().toLowerCase().includes("microsoft") && fs.existsSync("/etc/resolv.conf")) {
      try {
        const resolvConf = fs.readFileSync("/etc/resolv.conf", "utf-8");
        const nameserverLine = resolvConf
          .split(/\r?\n/)
          .find((line) => line.startsWith("nameserver "));
        const nameserver = nameserverLine?.split(/\s+/)[1]?.trim();

        if (nameserver) {
          return `http://${nameserver}:${backendPort}`;
        }
      } catch {
        // Fall back to localhost below.
      }
    }

    return `http://localhost:${backendPort}`;
  };

  const backendUrl = resolveBackendUrl();

  try {
    console.log(`[Agent] Registering with backend at ${backendUrl}`);
    const response = await fetch(`${backendUrl}/api/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId, genomeId })
    });

    if (!response.ok) {
      console.warn(`[Agent] Backend agent registration failed: ${response.status}`);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { peerId?: string } | null;
    console.log("[Agent] Registered with backend:", payload?.peerId ?? peerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Agent] Could not register peer ID with backend: ${message}`);
  }
};

export const runAgentLoop = async (
  genomeId: string,
  providedGenome?: AgentGenome,
  options: RunAgentLoopOptions = {}
): Promise<RunAgentLoopResult> => {
  console.log("Ensuring Genome")
  const genome = providedGenome ?? await ensureGenome(genomeId);
  console.log("Genome", genome)
  let task: AgentTask;
  let senderPeerId: string | undefined;
  let ourPeerId: string | undefined;

  // Get our own peer ID for identification
  try {
    const topology = await axlClient.getTopology();
    ourPeerId = topology.our_public_key;
    console.log("[Agent] Our peer ID:", ourPeerId.substring(0, 16) + "...");
    void registerAgentWithBackend(ourPeerId, genomeId);
  } catch (err) {
    console.warn("[Agent] Could not get local peer ID from AXL topology:", err);
  }

  if (options.task) {
    task = createAgentTask(options.task);
    console.log("Using provided task", task.id ?? "(no-id)");
  } else {
    console.log("Waiting for task from AXL (polling /recv)...");
    task = await new Promise<AgentTask>((resolve) => {
      axlSubscriber.subscribe("darwin/task", (t: any) => {
        // Extract sender peer ID if provided in the task payload
        if (t.senderPeerId && typeof t.senderPeerId === "string") {
          senderPeerId = t.senderPeerId;
          console.log("[Agent] Extracted sender peer ID:", t.senderPeerId.substring(0, 16) + "...");
        }
        console.log("Received task from AXL", t.id ?? "(no-id)");
        resolve(t);
      });
    });
    console.log("Task received from AXL", task.id ?? "(no-id)");
  }

  senderPeerId = task.senderPeerId;
  if (senderPeerId) {
    console.log("[Agent] Using sender peer ID from task:", senderPeerId.substring(0, 16) + "...");
  }

  // Stagger compute requests to avoid hitting rate limits
  // Extract agent number from genomeId (e.g., genesis-2 -> 2)
  const genomeMatch = genomeId.match(/\d+$/);
  const agentIndex = genomeMatch ? parseInt(genomeMatch[0], 10) : Math.floor(Math.random() * 5);
  const staggerDelayMs = agentIndex * 20_000; // 20 seconds between agents (10 req/min = 6sec per req)
  if (staggerDelayMs > 0) {
    console.log(`[Agent] Staggering compute request by ${staggerDelayMs}ms to avoid rate limit (agent #${agentIndex})`);
    await new Promise((resolve) => setTimeout(resolve, staggerDelayMs));
  }

  const market = new UniswapMarketAdapter();
  const compute = new ZeroGComputeAdapter();


  const keeper = new KeeperHubClient();
  const memory = await loadAgentMemory(storage, genome);
  const snapshot: MarketSnapshot = await market.getMarketSnapshot(task.context.poolAddress);
  const signals: AgentSignalSet = {
    priceMomentum: snapshot.price,
    volumeSignal: snapshot.volume,
    liquidityDepth: snapshot.liquidity,
    volatilityIndex: snapshot.volatility,
    blockTiming: 0.5
  };

  console.log("Signals: ", signals)


  const action = finalizeAction(
    await runReasoning(compute, { genome, task, signals, memory }),
    genome
  );

  const receipt = action.type === "swap" ? await keeper.execute(action) : undefined;

  // Outcome-based fitness (paper/simulated): if a prior paper position is due for evaluation, score it via PnL.
  // Otherwise fall back to the simple heuristic so early rounds still have a signal.
  const paperFitness = computePaperFitnessIfDue(memory, snapshot);
  const fitness = paperFitness ? paperFitness.score : calculateFitness(action, signals);

  const memoryRecord =
    action.type === "swap"
      ? {
        round: task.round,
        summary: action.rationale,
        outcome: paperFitness?.outcome ?? "flat",
        action
      }
      : {
        round: task.round,
        summary: action.rationale,
        action
      };

  const paperPosition = paperPositionFromAction(action, snapshot);
  await persistAgentMemory(storage, genome, {
    ...memoryRecord,
    fitness,
    ...(paperPosition ? { paperPosition } : {}),
    ...(paperFitness ? { paperPnl: paperFitness.pnl } : {})
  });

  const result = {
    id: typeof task.id === "string" ? `${task.id}-${genomeId}` : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    genomeId,
    taskId: task.id,
    taskRound: task.round,
    action,
    receipt,
    fitness,
    senderPeerId  // Will be undefined in direct mode, but available for peer-to-peer scenarios
  };

  try {
    // If we got a task via AXL (peer ID available), send result back to that peer
    // Otherwise, if we have a known backend peer, send there
    if (senderPeerId) {
      console.log("Sending result back to task sender:", senderPeerId.substring(0, 16) + "...");
      await axlBroadcaster.sendResultToPeer(senderPeerId, result);
    } else if (process.env.BACKEND_PEER_ID) {
      console.log("Sending result to backend peer:", process.env.BACKEND_PEER_ID.substring(0, 16) + "...");
      await axlBroadcaster.sendResultToPeer(process.env.BACKEND_PEER_ID, result);
    } else {
      console.log("[Agent] Result computed but no peer ID configured to send result to.");
      console.log("[Agent] Result would be sent to:", JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.warn("Failed to send result via AXL", err);
  }

  return {
    genomeId,
    task,
    action,
    ...(receipt ? { receipt } : {}),
    fitness
  };
};
