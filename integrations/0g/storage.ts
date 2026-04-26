import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";
import { Indexer, Batcher, getFlowContract, KvClient } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { env } from "../../config/env";



// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(env.RPC_URL);
let signer: ethers.Wallet | null = null;


const getGenomeStreamId = (): string => {
  const configured = env.KV_GENOME_STREAM_ID?.trim();

  if (!configured) {
    throw new Error("Missing KV_GENOME_STREAM_ID. Set it to a bytes32 stream hash (0x + 64 hex chars) or a plain stream label.");
  }

  // If a valid bytes32 stream ID is provided, use it directly.
  if (ethers.isHexString(configured, 32)) {
    return configured;
  }

  const streamId = ethers.id(configured);

  if (!ethers.isHexString(streamId, 32)) {
    throw new Error("Invalid KV_GENOME_STREAM_ID. Expected a bytes32 stream hash (0x + 64 hex chars) or a non-empty plain label.");
  }

  return streamId;
};

const getFlowContractFromNode = async (activeSigner: ethers.Wallet) => {
  const [nodes, err] = await indexer.selectNodes(1);
  if (err !== null) {
    throw new Error(`Error selecting nodes: ${err}`);
  }

  if (nodes.length === 0) {
    throw new Error("Indexer returned no storage nodes.");
  }

  const firstNode = nodes[0];
  if (!firstNode) {
    throw new Error("Indexer returned no storage node instance.");
  }

  const status = await firstNode.getStatus();
  const flowAddress = status?.networkIdentity?.flowAddress;
  if (!flowAddress || !ethers.isAddress(flowAddress)) {
    throw new Error("Unable to resolve a valid flowAddress from selected storage node status.");
  }

  return {
    nodes,
    flowContract: getFlowContract(flowAddress, activeSigner)
  };
};



const decodeGenomeValue = (dataBase64: string): AgentGenome => {
  const json = Buffer.from(dataBase64, "base64").toString("utf-8");
  return JSON.parse(json) as AgentGenome;
};

const toGenomeStorageKey = (genomeId: string): string =>
  genomeId.startsWith("genomes:") ? genomeId : `genomes:${genomeId}`;

const getSigner = (): ethers.Wallet => {
  if (signer) {
    return signer;
  }

  const key = env.privateKey;
  if (!key) {
    throw new Error(
      "Missing PRIVATE_KEY. Set PRIVATE_KEY in your environment as a 32-byte hex value (with or without 0x prefix)."
    );
  }

  if (!ethers.isHexString(key, 32)) {
    throw new Error(
      "Invalid PRIVATE_KEY format. Expected a 32-byte hex value, for example 0x<64 hex chars>."
    );
  }

  signer = new ethers.Wallet(key, provider);
  return signer;
};

// Initialize indexer — flow contract is auto-discovered
const indexer = new Indexer(env.INDEXER_RPC);




export class ZeroGStorageAdapter {
  private readonly genomes = new Map<string, AgentGenome>();
  private readonly memory = new Map<string, AgentMemoryRecord[]>();

  private async uploadToKV(streamId: string, key: string, value: AgentGenome) {
    const activeSigner = getSigner();
    const { nodes, flowContract } = await getFlowContractFromNode(activeSigner);
    const batcher = new Batcher(1, nodes, flowContract, env.RPC_URL);

    const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
    const valueBytes = Uint8Array.from(Buffer.from(JSON.stringify(value), 'utf-8'));

    batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);

    const [tx, batchErr] = await batcher.exec();
    console.log(`Batch execution result: ${tx}`);
    if (batchErr !== null) {
      throw new Error(`Batch execution error: ${batchErr}`);
    }

    console.log("KV upload successful! TX:", tx);
  }

  // Download data from 0G-KV
  private async downloadFromKV(streamId: string, key: string) {
    const keyBytes = Uint8Array.from(Buffer.from(key, "utf-8"));
    const keyBase64 = ethers.encodeBase64(keyBytes);
    const kvClient = new KvClient(env.KV_RPC_URL);
   
    try {
      const res = await kvClient.getValue(streamId, keyBase64 as unknown as Uint8Array);
      console.log(`Retrieved value for genome ${key}:`, res);
      return res
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("timeout")) {
        throw new Error(
          `KV read timeout from ${env.KV_RPC_URL}. Verify KV_RPC_URL and that stream ${streamId} exists and is reachable.`,
          { cause: error }
        );
      }

      throw error;
    }
  }

  public async setGenome(genome: AgentGenome): Promise<void> {
    await this.uploadToKV(getGenomeStreamId(), genome.storage_key, genome);
    console.log(`Genome ${genome.genome_id} stored with key ${genome.storage_key}`);
  }

  public async getGenome(genomeId: string): Promise<AgentGenome | null> {
    const streamId = getGenomeStreamId();
    const value = await this.downloadFromKV(streamId, toGenomeStorageKey(genomeId));
    console.log(`Retrieved value for genome ${genomeId}:`, value);
    if (!value?.data) {
      return null;
    }

    return decodeGenomeValue(value.data);
  }

  public async appendMemory(genomeId: string, record: AgentMemoryRecord): Promise<void> {
    const existing = this.memory.get(genomeId) ?? [];
    existing.push(record);
    this.memory.set(genomeId, existing);
  }

  public async getRecentMemory(genomeId: string, window: number): Promise<AgentMemoryRecord[]> {
    const existing = this.memory.get(genomeId) ?? [];
    return existing.slice(-window);
  }
}
