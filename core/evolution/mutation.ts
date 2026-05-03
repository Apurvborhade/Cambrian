import type { AgentGenome } from "../types/genome";
import { DEFAULT_MUTATION_RATE } from "../../config/constants";
import { assertValidGenome } from "../genome/validator";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";
import { keccak256, toUtf8Bytes } from "ethers";

export interface MutationRequest {
  parentA: AgentGenome;
  parentB: AgentGenome;
  mutationSeed: string;
  mutationRate?: number;
}

export const buildCrossoverPrompt = (request: MutationRequest): string => {
  const rate = request.mutationRate ?? DEFAULT_MUTATION_RATE;

  return [
    "You are a genome crossover engine.",
    "Blend the reasoning strategies coherently and mutate numeric parameters carefully.",
    `Mutation seed: ${request.mutationSeed}`,
    `Mutation rate: ${rate}`,
    `Parent A: ${JSON.stringify(request.parentA)}`,
    `Parent B: ${JSON.stringify(request.parentB)}`,
    "Return valid Darwin genome JSON only."
  ].join("\n");
};

export const normalizeChildGenome = (
  child: AgentGenome,
  request: MutationRequest
): AgentGenome => {
  const normalized: AgentGenome = {
    ...child,
    token_id: child.token_id ?? "",
    nft_contract: child.nft_contract ?? request.parentA.nft_contract ?? "",
    fitness: child.fitness ?? 0,
    generation: Math.max(request.parentA.generation, request.parentB.generation) + 1,
    parent_ids: [request.parentA.genome_id, request.parentB.genome_id],
    mutation_seed: request.mutationSeed,
    mutation_rate_at_birth: request.mutationRate ?? DEFAULT_MUTATION_RATE,
    storage_key: `genomes:${child.genome_id}`
  };

  return assertValidGenome(normalized);
};

const CROSSOVER_SYSTEM_PROMPT = [
  "You are a genome crossover engine for autonomous agents.",
  "Return ONLY strict JSON with genome fields and no markdown.",
  "Blend parent reasoning strategies and mutate numeric parameters conservatively.",
  "Keep all numeric weights and thresholds in [0,1]."
].join(" ");

const stripCodeFences = (content: string): string =>
  content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

const parseChildFromCompute = (content: string): Partial<AgentGenome> => {
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Compute response is not a JSON object.");
    }

    return parsed as Partial<AgentGenome>;
  } catch (error) {
    throw new Error("Failed to parse compute crossover response.", { cause: error });
  }
};

export const generateChildGenomeWithCompute = async (
  request: MutationRequest,
  compute: ZeroGComputeAdapter
): Promise<AgentGenome> => {
  const prompt = buildCrossoverPrompt(request);
  const content = await compute.inferRaw({
    model: "qwen/qwen-2.5-7b-instruct",
    system: CROSSOVER_SYSTEM_PROMPT,
    user: prompt,
    temperature: 0.7
  });

  const candidate = parseChildFromCompute(content);
  const resolvedGenomeId =
    typeof candidate.genome_id === "string" && candidate.genome_id.trim().length > 0
      ? candidate.genome_id.trim()
      : keccak256(
        toUtf8Bytes(
          JSON.stringify({
            parentA: request.parentA.genome_id,
            parentB: request.parentB.genome_id,
            seed: request.mutationSeed,
            content
          })
        )
      );

  console.log("Canditate Compute Child: ", candidate, content)
  
  const child: AgentGenome = {
    ...request.parentA,
    ...candidate,
    genome_id: resolvedGenomeId,
    token_id: "",
    fitness: 0,
    nft_address: "",
    storage_key: `genomes:${resolvedGenomeId}`
  };

  return normalizeChildGenome(child, request);
};
