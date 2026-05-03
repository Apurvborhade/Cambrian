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

const decodeJsonValue = <T>(dataBase64: string): T => {
  const json = Buffer.from(dataBase64, "base64").toString("utf-8");
  return JSON.parse(json) as T;
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

  private isNonceError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    return /nonce (has already been used|too low|expired)/i.test(message);
  }

  private async uploadToKV(streamId: string, key: string, value: unknown) {
    const activeSigner = getSigner();
    const { nodes, flowContract } = await getFlowContractFromNode(activeSigner);
    const batcher = new Batcher(1, nodes, flowContract, env.RPC_URL);

    const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
    const valueBytes = Uint8Array.from(Buffer.from(JSON.stringify(value), 'utf-8'));

    batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);

    const buildBatch = async (nonce?: number) => {
      return nonce === undefined ? batcher.exec() : batcher.exec({ nonce: BigInt(nonce) });
    };

    let nonce = await activeSigner.getNonce("pending");
    let [tx, batchErr] = await buildBatch(nonce);

    if (this.isNonceError(batchErr)) {
      nonce = await activeSigner.getNonce("pending");
      [tx, batchErr] = await buildBatch(nonce);
    }

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
    await this.setGenomeStatus(genome.genome_id, "active");
    await this.uploadToKV(getGenomeStreamId(), genome.storage_key, genome);
    console.log(`Genome ${genome.genome_id} stored with key ${genome.storage_key}`);
  }

  public async getGenome(genomeId: string): Promise<AgentGenome | null> {
    const status = await this.getGenomeStatus(genomeId);

    if (status === "deleted") {
      return null;
    }

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

  public async setJson<T>(key: string, value: T): Promise<void> {
    await this.uploadToKV(getGenomeStreamId(), key, value);
  }

  public async getJson<T>(key: string): Promise<T | null> {
    const streamId = getGenomeStreamId();
    const value = await this.downloadFromKV(streamId, key);

    if (!value?.data) {
      return null;
    }

    return decodeJsonValue<T>(value.data);
  }

  private genomeStatusKey(genomeId: string): string {
    return `genomes:status:${genomeId}`;
  }

  private async setGenomeStatus(genomeId: string, status: "active" | "deleted"): Promise<void> {
    await this.setJson(this.genomeStatusKey(genomeId), {
      status,
      updatedAt: new Date().toISOString()
    });
  }

  private async getGenomeStatus(genomeId: string): Promise<"active" | "deleted" | null> {
    const status = await this.getJson<{ status?: string }>(this.genomeStatusKey(genomeId));

    if (!status?.status) {
      return null;
    }

    if (status.status === "active" || status.status === "deleted") {
      return status.status;
    }

    return null;
  }

  public async isGenomeDeleted(genomeId: string): Promise<boolean> {
    return (await this.getGenomeStatus(genomeId)) === "deleted";
  }

  public async deleteGenome(genomeId: string): Promise<void> {
    this.genomes.delete(genomeId);
    await this.setGenomeStatus(genomeId, "deleted");
  }
}
