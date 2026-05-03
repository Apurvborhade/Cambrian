import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";
import { env } from "../../config/env";
import { ZeroGStorageAdapter } from "../0g/storage";
import { SupabaseStorageAdapter } from "../db/supabase";

type StorageMethod<T> = () => Promise<T>;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  if (timeoutMs <= 0) return promise;

  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Storage operation timed out after ${timeoutMs}ms (${label}).`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export class HybridStorageAdapter {
  private readonly primary: ZeroGStorageAdapter;
  private readonly fallback: SupabaseStorageAdapter;
  private degradedUntilMs = 0;
  private lastError: string | null = null;

  constructor(primary = new ZeroGStorageAdapter(), fallback = new SupabaseStorageAdapter()) {
    this.primary = primary;
    this.fallback = fallback;
  }

  private shouldUseFallback(): boolean {
    return Date.now() < this.degradedUntilMs;
  }

  private markDegraded(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.lastError = message;
    this.degradedUntilMs = Date.now() + Math.max(0, env.storageCooldownMs);
    console.warn(`[storage] primary (0G) degraded, using Supabase fallback for ${env.storageCooldownMs}ms: ${message}`);
  }

  private async run<T>(label: string, primaryCall: StorageMethod<T>, fallbackCall: StorageMethod<T>): Promise<T> {
    if (this.shouldUseFallback()) {
      return fallbackCall();
    }

    try {
      return await withTimeout(primaryCall(), env.storageTimeoutMs, label);
    } catch (error) {
      this.markDegraded(error);
      return fallbackCall();
    }
  }

  public async setGenome(genome: AgentGenome): Promise<void> {
    await this.run("setGenome", () => this.primary.setGenome(genome), () => this.fallback.setGenome(genome));
  }

  public async getGenome(genomeId: string): Promise<AgentGenome | null> {
    return this.run("getGenome", () => this.primary.getGenome(genomeId), () => this.fallback.getGenome(genomeId));
  }

  public async appendMemory(genomeId: string, record: AgentMemoryRecord): Promise<void> {
    await this.run(
      "appendMemory",
      () => this.primary.appendMemory(genomeId, record),
      () => this.fallback.appendMemory(genomeId, record)
    );
  }

  public async getRecentMemory(genomeId: string, window: number): Promise<AgentMemoryRecord[]> {
    return this.run(
      "getRecentMemory",
      () => this.primary.getRecentMemory(genomeId, window),
      () => this.fallback.getRecentMemory(genomeId, window)
    );
  }

  public async setJson<T>(key: string, value: T): Promise<void> {
    await this.run("setJson", () => this.primary.setJson(key, value), () => this.fallback.setJson(key, value));
  }

  public async getJson<T>(key: string): Promise<T | null> {
    return this.run("getJson", () => this.primary.getJson<T>(key), () => this.fallback.getJson<T>(key));
  }

  public async isGenomeDeleted(genomeId: string): Promise<boolean> {
    return this.run(
      "isGenomeDeleted",
      () => this.primary.isGenomeDeleted(genomeId),
      () => this.fallback.isGenomeDeleted(genomeId)
    );
  }

  public async deleteGenome(genomeId: string): Promise<void> {
    await this.run("deleteGenome", () => this.primary.deleteGenome(genomeId), () => this.fallback.deleteGenome(genomeId));
  }

  public getStatus() {
    return {
      degradedUntil: this.degradedUntilMs ? new Date(this.degradedUntilMs).toISOString() : null,
      lastError: this.lastError
    };
  }
}

