import { ethers } from "ethers";
import type { ZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { env } from "../../config/env";

export interface ZeroGInferenceAccountSnapshot {
  ledgerBalanceOg: string;
  ledgerAvailableOg: string;
  providerBalanceOg: string;
  providerPendingRefundOg: string;
}

interface NormalizedLedgerBalance {
  totalBalance: bigint;
  availableBalance: bigint;
}

const formatOg = (amount: bigint): string => ethers.formatEther(amount);
const formatOptionalOg = (amount: bigint | null): string => (amount === null ? "unavailable" : formatOg(amount));

const ogToWei = (amount: number): bigint => ethers.parseEther(amount.toString());

const normalizeLedgerBalance = (ledger: { totalBalance: bigint; availableBalance: bigint }): NormalizedLedgerBalance => {
  return {
    totalBalance: ledger.totalBalance,
    availableBalance: ledger.availableBalance
  };
};

const resolvedLedgerAddress = (broker: ZGComputeNetworkBroker): string => {
  return (broker.ledger as unknown as { ledgerCA?: string }).ledgerCA ??
    env.zeroGComputeLedgerAddress ??
    "unknown";
};

const resolvedInferenceAddress = (broker: ZGComputeNetworkBroker): string =>
  (broker.inference as unknown as { contractAddress?: string }).contractAddress ??
  env.zeroGComputeInferenceAddress ??
  "unknown";

const wrapLedgerError = (broker: ZGComputeNetworkBroker, error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("could not decode result data") || message.includes("BAD_DATA")) {
    throw new Error(
      "0G ledger lookup failed because the ledger contract did not return valid data. " +
        `This usually means RPC_URL (${env.RPC_URL}) is not the correct 0G Compute-serving network, ` +
        "or the broker-resolved ledger contract is wrong. " +
        `Resolved addresses: ledger=${resolvedLedgerAddress(broker)}, inference=${resolvedInferenceAddress(broker)}.`,
      { cause: error }
    );
  }

  throw error;
};

const wrapInferenceAccountError = (
  broker: ZGComputeNetworkBroker,
  providerAddress: string,
  error: unknown
): never => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("could not decode result data") || message.includes("BAD_DATA")) {
    throw new Error(
      "0G provider sub-account lookup failed because the inference contract did not return valid data. " +
        `This usually means RPC_URL (${env.RPC_URL}) is not the correct 0G Compute-serving network, ` +
        "the provider address is on a different network, or the broker-resolved inference contract is wrong. " +
        `Provider=${providerAddress}, inference=${resolvedInferenceAddress(broker)}.`,
      { cause: error }
    );
  }

  throw error;
};

const getLedgerBalance = async (broker: ZGComputeNetworkBroker): Promise<NormalizedLedgerBalance | null> => {
  try {
    return normalizeLedgerBalance(await broker.ledger.getLedger());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("could not decode result data") || message.includes("BAD_DATA")) {
      console.warn(
        "0G ledger lookup returned invalid data; continuing without ledger funding checks. " +
          `Resolved addresses: ledger=${resolvedLedgerAddress(broker)}, inference=${resolvedInferenceAddress(broker)}.`
      );
      return null;
    }

    return wrapLedgerError(broker, error);
  }
};

const getProviderAccount = async (broker: ZGComputeNetworkBroker, providerAddress: string) => {
  try {
    return await broker.inference.getAccount(providerAddress);
  } catch (error) {
    return wrapInferenceAccountError(broker, providerAddress, error);
  }
};

export class ZeroGComputeAccountManager {
  public async getInferenceAccountSnapshot(
    broker: ZGComputeNetworkBroker,
    providerAddress: string
  ): Promise<ZeroGInferenceAccountSnapshot> {
    const ledger = await getLedgerBalance(broker);
    const providerAccount = await getProviderAccount(broker, providerAddress);

    return {
      ledgerBalanceOg: formatOptionalOg(ledger?.totalBalance ?? null),
      ledgerAvailableOg: formatOptionalOg(ledger?.availableBalance ?? null),
      providerBalanceOg: formatOg(providerAccount.balance),
      providerPendingRefundOg: formatOg(providerAccount.pendingRefund)
    };
  }

  public async ensureInferenceAccountReady(
    broker: ZGComputeNetworkBroker,
    providerAddress: string
  ): Promise<ZeroGInferenceAccountSnapshot> {
    const minimumProviderBalance = ogToWei(env.zeroGComputeProviderFundOg);
    const ledgerSnapshot = await getLedgerBalance(broker);

    if (ledgerSnapshot === null) {
      const providerAccount = await getProviderAccount(broker, providerAddress);

      return {
        ledgerBalanceOg: "unavailable",
        ledgerAvailableOg: "unavailable",
        providerBalanceOg: formatOg(providerAccount.balance),
        providerPendingRefundOg: formatOg(providerAccount.pendingRefund)
      };
    }

    let ledger = ledgerSnapshot;

    if (ledger.totalBalance === 0n) {
      if (!env.zeroGComputeAutoDeposit) {
        throw new Error(
          "0G main ledger is empty. Deposit funds first, or set ZG_COMPUTE_AUTO_DEPOSIT=true " +
            `with ZG_COMPUTE_LEDGER_DEPOSIT_OG>=${env.zeroGComputeProviderFundOg}.`
        );
      }

      await broker.ledger.depositFund(env.zeroGComputeLedgerDepositOg);
      const refreshedLedger = await getLedgerBalance(broker);
      if (refreshedLedger === null) {
        throw new Error(
          "0G ledger lookup returned invalid data after deposit; cannot verify the ledger balance."
        );
      }

      ledger = refreshedLedger;
    }

    let providerAccount = await getProviderAccount(broker, providerAddress);

    if (providerAccount.balance < minimumProviderBalance) {
      const shortfall = minimumProviderBalance - providerAccount.balance;

      if (ledger.availableBalance < shortfall) {
        throw new Error(
          `0G ledger available balance (${formatOg(ledger.availableBalance)} OG) is below provider funding ` +
            `requirement (${formatOg(minimumProviderBalance)} OG). Fund the ledger or increase auto-deposit.`
        );
      }

      if (!env.zeroGComputeAutoTransfer) {
        throw new Error(
          `Provider sub-account balance is ${formatOg(providerAccount.balance)} OG, below the required ` +
            `${formatOg(minimumProviderBalance)} OG. Transfer funds first, or set ZG_COMPUTE_AUTO_TRANSFER=true.`
        );
      }

      await broker.ledger.transferFund(providerAddress, "inference", shortfall);
      providerAccount = await getProviderAccount(broker, providerAddress);
    }

    return {
      ledgerBalanceOg: formatOg(ledger.totalBalance),
      ledgerAvailableOg: formatOg(ledger.availableBalance),
      providerBalanceOg: formatOg(providerAccount.balance),
      providerPendingRefundOg: formatOg(providerAccount.pendingRefund)
    };
  }
}
