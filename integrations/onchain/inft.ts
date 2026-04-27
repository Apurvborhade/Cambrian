import {
  Contract,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  keccak256,
  isAddress,
  isHexString,
  toUtf8Bytes,
  type BigNumberish,
  type ContractTransactionResponse,
  type TransactionReceipt
} from "ethers";
import { env } from "../../config/env";

const INFT_ABI = [
  "function mint(address to,bytes32 _genomeId,uint256 parentA,uint256 parentB) external returns (uint256)",
  "function burn(uint256 tokenId) external",
  "function getGenomeId(uint256 tokenId) external view returns (bytes32)",
  "function getParents(uint256 tokenId) external view returns (uint256 parentA,uint256 parentB)",
  "function totalMinted() external view returns (uint256)",
  "event AgentMinted(uint256 indexed tokenId,bytes32 indexed genomeId,uint256 parentA,uint256 parentB)",
  "event AgentBurned(uint256 indexed tokenId)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)"
] as const;

interface INFTContract {
  mint(
    to: string,
    genomeId: string,
    parentA: BigNumberish,
    parentB: BigNumberish
  ): Promise<ContractTransactionResponse>;
  burn(tokenId: BigNumberish): Promise<ContractTransactionResponse>;
  getGenomeId(tokenId: BigNumberish): Promise<string>;
  getParents(tokenId: BigNumberish): Promise<readonly [bigint, bigint]>;
  totalMinted(): Promise<bigint>;
  interface: Contract["interface"];
}

export interface MintAgentRequest {
  to: string;
  genomeId: string;
  parentA?: BigNumberish;
  parentB?: BigNumberish;
}

export interface OnchainTxResult {
  txHash: string;
  blockNumber: number;
  gasUsed: bigint;
}

export interface MintAgentResult extends OnchainTxResult {
  tokenId: bigint | null;
  genomeIdBytes32: string;
}

const assertAddress = (value: string, fieldName: string): void => {
  if (!value || !isAddress(value)) {
    throw new Error(`Invalid ${fieldName}: ${value || "(empty)"}`);
  }
};

const assertHexBytes32 = (value: string, fieldName: string): void => {
  if (!isHexString(value, 32)) {
    throw new Error(`Invalid ${fieldName}. Expected bytes32 (0x + 64 hex chars).`);
  }
};

const toGenomeIdBytes32 = (genomeId: string): string => {
  const normalized = genomeId.trim();
  if (!normalized) {
    throw new Error("Invalid genomeId. Expected a non-empty string.");
  }

  if (isHexString(normalized, 32)) {
    return normalized;
  }

  return keccak256(toUtf8Bytes(normalized));
};

const requireReceipt = async (tx: ContractTransactionResponse): Promise<TransactionReceipt> => {
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error(`Transaction ${tx.hash} did not return a receipt.`);
  }

  return receipt;
};

const toOnchainTxResult = (receipt: TransactionReceipt): OnchainTxResult => ({
  txHash: receipt.hash,
  blockNumber: receipt.blockNumber,
  gasUsed: receipt.gasUsed
});

const toINFTContract = (address: string, runner: JsonRpcProvider | Wallet): INFTContract => {
  return new Contract(address, INFT_ABI, runner) as unknown as INFTContract;
};

export class INFTOnchainAdapter {
  private readonly contract: INFTContract;

  constructor(contractAddress: string, signer: Wallet) {
    assertAddress(contractAddress, "INFT contract address");
    this.contract = toINFTContract(contractAddress, signer);
  }

  public static fromEnv(): INFTOnchainAdapter {
    const contractAddress = env.inftContractAddress?.trim();
    const rpcUrl = env.RPC_URL?.trim();
    const privateKey = env.privateKey?.trim();

    if (!contractAddress) {
      throw new Error("Missing INFT_CONTRACT_ADDRESS in environment.");
    }

    if (!rpcUrl) {
      throw new Error("Missing RPC_URL in environment.");
    }

    if (!privateKey) {
      throw new Error("Missing PRIVATE_KEY in environment.");
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    return new INFTOnchainAdapter(contractAddress, signer);
  }

  public async mint(request: MintAgentRequest): Promise<MintAgentResult> {
    assertAddress(request.to, "mint.to");
    const genomeIdBytes32 = toGenomeIdBytes32(request.genomeId);
    assertHexBytes32(genomeIdBytes32, "mint.genomeId");

    const parentA = request.parentA ?? 0n;
    const parentB = request.parentB ?? 0n;

    const tx = await this.contract.mint(request.to, genomeIdBytes32, parentA, parentB);
    const receipt = await requireReceipt(tx);
    const baseResult = toOnchainTxResult(receipt);

    let tokenId: bigint | null = null;
    for (const log of receipt.logs) {
      const parsed = this.contract.interface.parseLog(log);
      if (parsed?.name === "Transfer" && parsed.args[0] === ZeroAddress) {
        tokenId = parsed.args[2] as bigint;
        break;
      }
    }

    return {
      ...baseResult,
      tokenId,
      genomeIdBytes32
    };
  }

  public async burn(tokenId: BigNumberish): Promise<OnchainTxResult> {
    const tx = await this.contract.burn(tokenId);
    return toOnchainTxResult(await requireReceipt(tx));
  }

  public async getGenomeId(tokenId: BigNumberish): Promise<string> {
    return this.contract.getGenomeId(tokenId);
  }

  public async getParents(tokenId: BigNumberish): Promise<readonly [bigint, bigint]> {
    return this.contract.getParents(tokenId);
  }

  public async totalMinted(): Promise<bigint> {
    return this.contract.totalMinted();
  }
}
