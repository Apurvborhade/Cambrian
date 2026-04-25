import type { ExecutionReceipt } from "./client";

export class KeeperHubAuditClient {
  private readonly receipts = new Map<string, ExecutionReceipt[]>();

  public record(agentId: string, receipt: ExecutionReceipt): void {
    const existing = this.receipts.get(agentId) ?? [];
    existing.push(receipt);
    this.receipts.set(agentId, existing);
  }

  public async getAuditLog(agentId: string): Promise<ExecutionReceipt[]> {
    return this.receipts.get(agentId) ?? [];
  }
}
