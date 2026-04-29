import { randomUUID } from "crypto";
import type { AgentAction, AgentMemoryRecord } from "../types/agent";
import type { AgentGenome } from "../types/genome";
import { createSeedGenomes } from "../genome/generator";
import { calculateFitness } from "../evolution/fitness";
import { generateChildGenomeWithCompute, type MutationRequest } from "../evolution/mutation";
import { ZeroGStorageAdapter } from "../../integrations/0g/storage";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";
import { INFTOnchainAdapter } from "../../integrations/onchain/inft";
import { runAgentLoop } from "../../apps/agent/loop";
import { env } from "../../config/env";
import { Wallet, isHexString } from "ethers";
import { emitArenaEvent } from "./arenaEvents";

interface ArenaStateRecord {
  arenaId: string;
  size: number;
  generation: number;
  round: number;
  genomeIds: string[];
  updatedAt: string;
}

interface ArenaFitnessRecord {
  genomeId: string;
  fitness: number;
  generation: number;
  round: number;
  decidedAt: string;
}

export interface ArenaRoundAgentResult {
  genomeId: string;
  tokenId: string;
  fitness: number;
  action: AgentAction;
}

export interface ArenaRoundResult {
  arenaId: string;
  generation: number;
  round: number;
  ranked: ArenaRoundAgentResult[] | any[];
}

export interface ArenaStateView {
  arenaId: string;
  size: number;
  generation: number;
  round: number;
  genomeIds: string[];
  updatedAt: string;
}

export interface ArenaDetails {
  state: ArenaStateView;
  genomes: AgentGenome[];
}

const storage = new ZeroGStorageAdapter();
const compute = new ZeroGComputeAdapter();
const genomeFallback = new Map<string, AgentGenome>();
const arenaStateFallback = new Map<string, ArenaStateRecord>();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const withSmallMutation = (value: number): number => {
  const noise = (Math.random() - 0.5) * 0.08;
  return clamp(value + noise, 0, 1);
};

const arenaStateKey = (arenaId: string): string => `arenas:${arenaId}:state`;
const arenaRoundFitnessKey = (arenaId: string, generation: number, round: number): string =>
  `arenas:${arenaId}:fitness:g${generation}:r${round}`;

const parseTokenId = (value: string): bigint => {
  try {
    if (!value.trim()) {
      return 0n;
    }

    return BigInt(value);
  } catch {
    return 0n;
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

const getOnchainAdapter = (): INFTOnchainAdapter | null => {
  try {
    return INFTOnchainAdapter.fromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] onchain adapter unavailable: ${message}`);
    return null;
  }
};

const safeSetGenome = async (genome: AgentGenome): Promise<void> => {
  genomeFallback.set(genome.genome_id, genome);

  try {
    await storage.setGenome(genome);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] failed to store genome ${genome.genome_id} in KV, using fallback cache: ${message}`);
  }
};

const safeGetGenome = async (genomeId: string): Promise<AgentGenome | null> => {
  if (await storage.isGenomeDeleted(genomeId)) {
    genomeFallback.delete(genomeId);
    return null;
  }

  const cached = genomeFallback.get(genomeId);
  if (cached) {
    return cached;
  }

  try {
    const genome = await storage.getGenome(genomeId);
    if (genome) {
      genomeFallback.set(genomeId, genome);
      return genome;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] failed to read genome ${genomeId} from KV, checking fallback cache: ${message}`);
  }

  return genomeFallback.get(genomeId) ?? null;
};

const safeSetArenaState = async (state: ArenaStateRecord): Promise<void> => {
  arenaStateFallback.set(state.arenaId, state);

  try {
    await storage.setJson(arenaStateKey(state.arenaId), state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] failed to persist arena state for ${state.arenaId}, using fallback cache: ${message}`);
  }

  emitArenaEvent({
    type: "arena.state.updated",
    arenaId: state.arenaId,
    timestamp: state.updatedAt,
    data: {
      state: toArenaStateView(state)
    }
  });
};

const safeGetArenaState = async (arenaId: string): Promise<ArenaStateRecord | null> => {
  try {
    const state = await storage.getJson<ArenaStateRecord>(arenaStateKey(arenaId));
    if (state) {
      arenaStateFallback.set(arenaId, state);
      return state;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] failed to fetch arena state for ${arenaId} from KV, checking fallback cache: ${message}`);
  }

  return arenaStateFallback.get(arenaId) ?? null;
};

const safePersistFitness = async (
  arenaId: string,
  generation: number,
  round: number,
  records: ArenaFitnessRecord[]
): Promise<void> => {
  try {
    await storage.setJson(arenaRoundFitnessKey(arenaId, generation, round), records);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[arena] failed to persist round fitness for ${arenaId} generation ${generation} round ${round}: ${message}`
    );
  }
};

const toArenaStateView = (state: ArenaStateRecord): ArenaStateView => ({
  arenaId: state.arenaId,
  size: state.size,
  generation: state.generation,
  round: state.round,
  genomeIds: [...state.genomeIds],
  updatedAt: state.updatedAt
});

const buildExtraSeed = (base: AgentGenome, index: number): AgentGenome => {
  const genomeId = `genesis-${index + 1}-${randomUUID().slice(0, 8)}`;

  return {
    ...base,
    genome_id: genomeId,
    token_id: "",
    fitness: 0,
    storage_key: `genomes:${genomeId}`,
    mutation_seed: `${base.mutation_seed}-extra-${index + 1}`,
    nft_address: ""
  };
};

const buildSeedPopulation = (size: number): AgentGenome[] => {
  const seeds = createSeedGenomes();

  if (size <= seeds.length) {
    return seeds.slice(0, size).map((seed) => ({ ...seed, fitness: 0, token_id: "" }));
  }

  const population = [...seeds];
  let cursor = 0;

  while (population.length < size) {
    const base = seeds[cursor % seeds.length];
    if (!base) {
      break;
    }

    population.push(buildExtraSeed(base, population.length));
    cursor += 1;
  }

  return population;
};

const asMemoryFitnessRecord = (
  round: number,
  fitness: number,
  action: AgentAction,
  generation: number
): AgentMemoryRecord => ({
  round,
  summary: `Arena fitness recorded for generation ${generation}, round ${round}.`,
  action,
  fitness
});

const roundFitnessScore = (action: AgentAction): number =>
  Number(calculateFitness(action, { trend: "neutral" }).toFixed(4));

const mintGenome = async (
  onchain: INFTOnchainAdapter | null,
  genome: AgentGenome,
  parentA: bigint,
  parentB: bigint
): Promise<AgentGenome> => {
  if (!onchain) {
    return genome;
  }

  const recipient = resolveMintRecipient();
  if (!recipient) {
    console.warn(`[arena] mint skipped for ${genome.genome_id}: missing INFT_MINT_TO_ADDRESS and valid PRIVATE_KEY`);
    return genome;
  }

  try {
    const mintResult = await onchain.mint({
      to: recipient,
      genomeId: genome.genome_id,
      parentA,
      parentB
    });

    if (mintResult.tokenId === null) {
      console.warn(`[arena] mint returned no tokenId for ${genome.genome_id}`);
      return genome;
    }

    const tokenId = mintResult.tokenId.toString();
    const nftContract = env.inftContractAddress?.trim() ?? genome.nft_contract;

    return {
      ...genome,
      token_id: tokenId,
      nft_contract: nftContract,
      nft_address: nftContract ? `${nftContract}:${tokenId}` : genome.nft_address
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] mint failed for ${genome.genome_id}: ${message}`);
    return genome;
  }
};

const burnGenome = async (arenaId: string, onchain: INFTOnchainAdapter | null, genome: AgentGenome): Promise<void> => {
  if (!onchain) {
    return;
  }

  const configuredContract = env.inftContractAddress?.trim();
  if (
    configuredContract &&
    genome.nft_contract &&
    configuredContract.toLowerCase() !== genome.nft_contract.toLowerCase()
  ) {
    console.warn(
      `[arena] burn skipped for ${genome.genome_id}: genome contract ${genome.nft_contract} does not match configured INFT_CONTRACT_ADDRESS ${configuredContract}`
    );
    return;
  }

  const tokenId = parseTokenId(genome.token_id);
  if (tokenId <= 0n) {
    console.warn(`[arena] burn skipped for ${genome.genome_id}: missing token_id`);
    return;
  }

  const permission = await onchain.checkBurnPermission(tokenId);
  if (!permission.allowed) {
    console.warn(
      `[arena] burn skipped for ${genome.genome_id}: ${permission.reason ?? "permission denied"} ` +
      `(signer=${permission.signer}, owner=${permission.contractOwner})`
    );
    return;
  }

  try {
    const result = await onchain.burn(tokenId);
    console.log(`[arena] burned genome ${genome.genome_id} token ${genome.token_id} tx ${result.txHash}`);

    emitArenaEvent({
      type: "arena.genome.burned",
      arenaId,
      timestamp: new Date().toISOString(),
      data: {
        genome,
        tokenId: genome.token_id,
        txHash: result.txHash
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] burn failed for ${genome.genome_id}: ${message}`);
  }
};

const getArenaGenomes = async (arenaId: string): Promise<{ state: ArenaStateRecord; genomes: AgentGenome[] }> => {
  const state = await safeGetArenaState(arenaId);
  if (!state) {
    throw new Error(`Arena ${arenaId} not found. Call createArena first.`);
  }

  const genomes = (
    await Promise.all(state.genomeIds.map(async (genomeId) => safeGetGenome(genomeId)))
  ).filter((genome): genome is AgentGenome => Boolean(genome));

  if (genomes.length === 0) {
    throw new Error(`Arena ${arenaId} has no accessible genomes.`);
  }

  return { state, genomes };
};

export const arenaExists = async (arenaId: string): Promise<boolean> => {
  return (await safeGetArenaState(arenaId)) !== null;
};

export const getArenaState = async (arenaId: string): Promise<ArenaStateView | null> => {
  const state = await safeGetArenaState(arenaId);
  return state ? toArenaStateView(state) : null;
};

export const getArenaAgents = async (arenaId: string): Promise<AgentGenome[]> => {
  const { genomes } = await getArenaGenomes(arenaId);
  return genomes;
};

export const getArenaDetails = async (arenaId: string): Promise<ArenaDetails | null> => {
  const state = await safeGetArenaState(arenaId);
  if (!state) {
    return null;
  }

  const genomes = (
    await Promise.all(state.genomeIds.map(async (genomeId) => safeGetGenome(genomeId)))
  ).filter((genome): genome is AgentGenome => Boolean(genome));

  return {
    state: toArenaStateView(state),
    genomes
  };
};

const loadExistingArenaGenomes = async (arenaId: string): Promise<AgentGenome[] | null> => {
  const state = await safeGetArenaState(arenaId);
  if (!state) {
    return null;
  }

  const genomes = (
    await Promise.all(state.genomeIds.map(async (genomeId) => safeGetGenome(genomeId)))
  ).filter((genome): genome is AgentGenome => Boolean(genome));

  return genomes;
};

export const createArena = async (arenaId: string, size: number): Promise<AgentGenome[]> => {
  if (!arenaId.trim()) {
    throw new Error("createArena requires a non-empty arenaId.");
  }

  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("createArena size must be a positive integer.");
  }

  const existingArenaGenomes = await loadExistingArenaGenomes(arenaId);
  if (existingArenaGenomes) {
    console.log(`[arena:${arenaId}] reusing existing arena with ${existingArenaGenomes.length} genomes`);
    return existingArenaGenomes;
  }

  const onchain = getOnchainAdapter();
  const seedPopulation = buildSeedPopulation(size);
  const storedGenomes: AgentGenome[] = [];

  for (const seed of seedPopulation) {
    const existingGenome = await safeGetGenome(seed.genome_id);

    if (existingGenome) {
      storedGenomes.push(existingGenome);
      emitArenaEvent({
        type: "arena.genome.reused",
        arenaId,
        timestamp: new Date().toISOString(),
        data: {
          genome: existingGenome,
          source: "existing"
        }
      });
      console.log(
        `[arena:${arenaId}] reused genome=${existingGenome.genome_id} token=${existingGenome.token_id || "unminted"} contract=${existingGenome.nft_contract || "n/a"}`
      );
      continue;
    }

    const minted = await mintGenome(onchain, seed, 0n, 0n);
    await safeSetGenome(minted);
    storedGenomes.push(minted);

    emitArenaEvent({
      type: "arena.genome.minted",
      arenaId,
      timestamp: new Date().toISOString(),
      data: {
        genome: minted,
        source: "seed"
      }
    });

    console.log(
      `[arena:${arenaId}] seeded genome=${minted.genome_id} token=${minted.token_id || "unminted"} contract=${minted.nft_contract || "n/a"}`
    );
  }

  const initialState: ArenaStateRecord = {
    arenaId,
    size,
    generation: 0,
    round: 0,
    genomeIds: storedGenomes.map((genome) => genome.genome_id),
    updatedAt: new Date().toISOString()
  };

  await safeSetArenaState(initialState);

  emitArenaEvent({
    type: "arena.created",
    arenaId,
    timestamp: initialState.updatedAt,
    data: {
      state: toArenaStateView(initialState),
      agents: [...storedGenomes]
    }
  });

  return storedGenomes;
};

const persistGenomeFitness = async (genomeId: string, fitness: number): Promise<void> => {
  try {
    const key = `genomes:fitness:${genomeId}`;
    await storage.setJson(key, { fitness, updatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] failed to persist fitness for ${genomeId}: ${message}`);
  }
};

export const runArenaRound = async (arenaId: string): Promise<ArenaRoundResult> => {
  const { state, genomes } = await getArenaGenomes(arenaId);
  const nextRound = state.round + 1;

  emitArenaEvent({
    type: "arena.round.started",
    arenaId,
    timestamp: new Date().toISOString(),
    data: {
      generation: state.generation,
      round: nextRound,
      genomeIds: [...state.genomeIds]
    }
  });

  const ranked: any[] = [];

  for (const genome of genomes) {
    try {
      const result = await runAgentLoop(genome.genome_id, genome);
      const fitness = result.fitness;

      console.log(`Fitness of agent ${genome.genome_id}: `, fitness)
      const updatedGenome: AgentGenome = {
        ...genome,
        fitness
      };

      if (genome.token_id && genome.nft_contract) {
        await persistGenomeFitness(genome.genome_id, fitness);
      } else {
        await safeSetGenome(updatedGenome);
      }
      await storage.appendMemory(
        genome.genome_id,
        asMemoryFitnessRecord(nextRound, fitness, result.action, state.generation)
      );

      console.log(
        `[arena:${arenaId}] decision genome=${genome.genome_id} direction=${result.action.direction} confidence=${result.action.confidence}`
      );
      console.log(`[arena:${arenaId}] fitness genome=${genome.genome_id} score=${fitness.toFixed(4)}`);

      ranked.push({
        ...genome,
        genomeId: genome.genome_id,
        tokenId: updatedGenome.token_id,
        fitness,
        action: result.action
      });

      emitArenaEvent({
        type: "arena.agent.evaluated",
        arenaId,
        timestamp: new Date().toISOString(),
        data: {
          genome: updatedGenome,
          action: result.action,
          fitness,
          generation: state.generation,
          round: nextRound
        }
      });
    } catch (error) {
      const failedAction: AgentAction = {
        type: "observe",
        direction: "flat",
        confidence: 0,
        rationale: "Agent loop failed during round execution."
      };

      const fitness = -1;
      const updatedGenome: AgentGenome = {
        ...genome,
        fitness
      };

      if (genome.token_id && genome.nft_contract) {
        await persistGenomeFitness(genome.genome_id, fitness);
      } else {
        await safeSetGenome(updatedGenome);
      }
      await storage.appendMemory(
        genome.genome_id,
        asMemoryFitnessRecord(nextRound, fitness, failedAction, state.generation)
      );

      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[arena:${arenaId}] agent failed genome=${genome.genome_id}: ${message}`);
      console.log(`[arena:${arenaId}] fitness genome=${genome.genome_id} score=${fitness.toFixed(4)}`);

      ranked.push({
        genomeId: genome.genome_id,
        tokenId: updatedGenome.token_id,
        fitness,
        action: failedAction
      });

      emitArenaEvent({
        type: "arena.agent.evaluated",
        arenaId,
        timestamp: new Date().toISOString(),
        data: {
          genome: updatedGenome,
          action: failedAction,
          fitness,
          generation: state.generation,
          round: nextRound
        }
      });
    }
  }

  ranked.sort((left, right) => right.fitness - left.fitness);

  const fitnessRecords: ArenaFitnessRecord[] = ranked.map((entry) => ({
    genomeId: entry.genomeId,
    fitness: entry.fitness,
    generation: state.generation,
    round: nextRound,
    decidedAt: new Date().toISOString()
  }));

  await safePersistFitness(arenaId, state.generation, nextRound, fitnessRecords);

  const nextState: ArenaStateRecord = {
    ...state,
    round: nextRound,
    updatedAt: new Date().toISOString()
  };
  await safeSetArenaState(nextState);

  emitArenaEvent({
    type: "arena.round.completed",
    arenaId,
    timestamp: nextState.updatedAt,
    data: {
      result: {
        arenaId,
        generation: state.generation,
        round: nextRound,
        ranked
      }
    }
  });

  return {
    arenaId,
    generation: state.generation,
    round: nextRound,
    ranked
  };
};

const generateChildGenomeFallback = (g1: AgentGenome, g2: AgentGenome): AgentGenome => {
  const genomeId = randomUUID();
  const strategy = Math.random() < 0.5 ? g1.reasoning_strategy : g2.reasoning_strategy;
  const riskThreshold = withSmallMutation((g1.risk_threshold + g2.risk_threshold) / 2);

  const mixWeights = (left: AgentGenome["tool_weights"], right: AgentGenome["tool_weights"]): AgentGenome["tool_weights"] => ({
    price_momentum: withSmallMutation((left.price_momentum + right.price_momentum) / 2),
    volume_signal: withSmallMutation((left.volume_signal + right.volume_signal) / 2),
    liquidity_depth: withSmallMutation((left.liquidity_depth + right.liquidity_depth) / 2),
    volatility_index: withSmallMutation((left.volatility_index + right.volatility_index) / 2),
    block_timing: withSmallMutation((left.block_timing + right.block_timing) / 2)
  });

  return {
    genome_id: genomeId,
    token_id: "",
    nft_contract: env.inftContractAddress?.trim() ?? g1.nft_contract ?? g2.nft_contract,
    fitness: 0,
    generation: Math.max(g1.generation, g2.generation) + 1,
    parent_ids: [g1.genome_id, g2.genome_id],
    mutation_seed: `child-${genomeId.slice(0, 8)}`,
    mutation_rate_at_birth: withSmallMutation((g1.mutation_rate_at_birth + g2.mutation_rate_at_birth) / 2),
    reasoning_strategy: strategy,
    tool_weights: mixWeights(g1.tool_weights, g2.tool_weights),
    risk_threshold: riskThreshold,
    memory_window: Math.max(1, Math.round((g1.memory_window + g2.memory_window) / 2)),
    created_at_block: Math.max(g1.created_at_block, g2.created_at_block),
    storage_key: `genomes:${genomeId}`,
    nft_address: ""
  };
};

export const generateChildGenome = async (g1: AgentGenome, g2: AgentGenome): Promise<AgentGenome> => {
  const request: MutationRequest = {
    parentA: g1,
    parentB: g2,
    mutationSeed: `child-${randomUUID().slice(0, 8)}`
  };

  try {
    return await generateChildGenomeWithCompute(request, compute);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[arena] compute crossover failed, using fallback mutation logic: ${message}`);
    return generateChildGenomeFallback(g1, g2);
  }
};

export const evolveArena = async (arenaId: string, rankedGenomes: any[]): Promise<AgentGenome[]> => {
  const { state, genomes } = await getArenaGenomes(arenaId);

  if (rankedGenomes.length <= 1) {
    return rankedGenomes as AgentGenome[];
  }

  // We shrink the population by burning multiple worst genomes each generation.
  // Default is 2 (net -1 population because we still mint 1 child), and we stop once 1 remains.
  const configuredBurnCount = Number.isInteger(env.arenaBurnsPerGeneration) ? env.arenaBurnsPerGeneration : 2;
  const burnCount = Math.max(2, configuredBurnCount);

  if (rankedGenomes.length === 2) {
    const best = rankedGenomes[0];
    const worst = rankedGenomes[1];
    const onchain = getOnchainAdapter();

    await burnGenome(arenaId, onchain, worst);

    const nextState: ArenaStateRecord = {
      ...state,
      generation: state.generation + 1,
      round: 0,
      genomeIds: [best.genome_id],
      updatedAt: new Date().toISOString()
    };

    await safeSetArenaState(nextState);
    return [best];
  }

  const best = rankedGenomes[0];
  const second = rankedGenomes[1];
  const burnTargets = rankedGenomes.slice(-Math.min(burnCount, rankedGenomes.length - 2));

  if (!best || !second || burnTargets.length === 0) {
    throw new Error(`Arena ${arenaId} selection failed because rankings are incomplete.`);
  }

  emitArenaEvent({
    type: "arena.child.planned",
    arenaId,
    timestamp: new Date().toISOString(),
    data: {
      generation: state.generation + 1,
      parents: {
        best,
        second
      }
    }
  });

  console.log(
    `[arena:${arenaId}] selected best=${best.genome_id} (${best.fitness.toFixed(4)}), second=${second.genome_id} (${second.fitness.toFixed(4)}), burns=${burnTargets.map((g: any) => g.genome_id).join(",")}`
  );

  let child = await generateChildGenome(best, second);
  const onchain = getOnchainAdapter();

  child = await mintGenome(onchain, child, parseTokenId(best.token_id), parseTokenId(second.token_id));
  await safeSetGenome(child);

  emitArenaEvent({
    type: "arena.child.created",
    arenaId,
    timestamp: new Date().toISOString(),
    data: {
      generation: state.generation + 1,
      child,
      parents: {
        best,
        second
      }
    }
  });

  console.log(`[arena:${arenaId}] created child genome=${child.genome_id} token=${child.token_id || "unminted"}`);

  for (const target of burnTargets) {
    await burnGenome(arenaId, onchain, target);
  }

  const burnIds = new Set(burnTargets.map((g: any) => g.genome_id));
  const nextGenomes = rankedGenomes.filter((genome) => !burnIds.has(genome.genome_id));
  nextGenomes.push(child);

  const nextState: ArenaStateRecord = {
    ...state,
    generation: state.generation + 1,
    round: 0,
    genomeIds: nextGenomes.map((genome) => genome.genome_id),
    updatedAt: new Date().toISOString()
  };

  await safeSetArenaState(nextState);
  return nextGenomes;
};

export const runArena = async (arenaId: string, generations: number): Promise<AgentGenome[]> => {
  if (!Number.isInteger(generations) || generations <= 0) {
    throw new Error("runArena requires generations to be a positive integer.");
  }

  let latest = (await getArenaGenomes(arenaId)).genomes;

  for (let generation = 0; generation < generations; generation += 1) {
    const round = await runArenaRound(arenaId);
    console.log("Ranked: ",round.ranked)
    console.log(
      `[arena:${arenaId}] generation=${round.generation} round=${round.round} top=${round.ranked[0]?.genomeId ?? "none"}`
    );

    latest = await evolveArena(arenaId,round.ranked);
    if (latest.length <= 1) {
      console.log(`[arena:${arenaId}] stopping evolution early: ${latest.length} agent remaining`);
      break;
    }
  }

  return latest;
};
