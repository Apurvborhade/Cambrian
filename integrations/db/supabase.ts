import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentGenome } from "../../core/types/genome";
import type { AgentMemoryRecord } from "../../core/types/agent";
import { env } from "../../config/env";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class SupabaseStorageAdapter {
  private client: SupabaseClient;

  constructor() {
    const url = env.supabaseUrl.trim();
    const key = env.supabaseServiceRoleKey.trim();
    if (!url || !key) {
      throw new Error("Supabase storage fallback requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "cambrian-storage-fallback" } }
    });
  }

  private genomeStatusKey(genomeId: string): string {
    return `genomes:status:${genomeId}`;
  }

  private async setJsonInternal(key: string, value: Json): Promise<void> {
    const { error } = await this.client
      .from("json_kv")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(`Supabase setJson failed: ${error.message}`);
  }

  public async setJson<T>(key: string, value: T): Promise<void> {
    await this.setJsonInternal(key, value as unknown as Json);
  }

  public async getJson<T>(key: string): Promise<T | null> {
    const { data, error } = await this.client.from("json_kv").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(`Supabase getJson failed: ${error.message}`);
    if (!data) return null;
    return data.value as T;
  }

  private async setGenomeStatus(genomeId: string, status: "active" | "deleted"): Promise<void> {
    await this.setJsonInternal(this.genomeStatusKey(genomeId), { status, updatedAt: new Date().toISOString() });
  }

  private async getGenomeStatus(genomeId: string): Promise<"active" | "deleted" | null> {
    const record = await this.getJson<{ status?: string }>(this.genomeStatusKey(genomeId));
    if (!record?.status) return null;
    if (record.status === "active" || record.status === "deleted") return record.status;
    return null;
  }

  public async isGenomeDeleted(genomeId: string): Promise<boolean> {
    return (await this.getGenomeStatus(genomeId)) === "deleted";
  }

  public async deleteGenome(genomeId: string): Promise<void> {
    await this.setGenomeStatus(genomeId, "deleted");
  }

  public async setGenome(genome: AgentGenome): Promise<void> {
    await this.setGenomeStatus(genome.genome_id, "active");
    const { error } = await this.client
      .from("genomes")
      .upsert(
        { genome_id: genome.genome_id, storage_key: genome.storage_key, genome, updated_at: new Date().toISOString() },
        { onConflict: "genome_id" }
      );
    if (error) throw new Error(`Supabase setGenome failed: ${error.message}`);
  }

  public async getGenome(genomeId: string): Promise<AgentGenome | null> {
    const status = await this.getGenomeStatus(genomeId);
    if (status === "deleted") return null;

    const { data, error } = await this.client.from("genomes").select("genome").eq("genome_id", genomeId).maybeSingle();
    if (error) throw new Error(`Supabase getGenome failed: ${error.message}`);
    if (!data) return null;
    return data.genome as AgentGenome;
  }

  public async appendMemory(genomeId: string, record: AgentMemoryRecord): Promise<void> {
    const { error } = await this.client.from("memory").insert({
      genome_id: genomeId,
      record,
      created_at: new Date().toISOString()
    });
    if (error) throw new Error(`Supabase appendMemory failed: ${error.message}`);
  }

  public async getRecentMemory(genomeId: string, window: number): Promise<AgentMemoryRecord[]> {
    const limit = Math.max(0, window);
    if (limit === 0) return [];

    const { data, error } = await this.client
      .from("memory")
      .select("record,created_at")
      .eq("genome_id", genomeId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase getRecentMemory failed: ${error.message}`);
    if (!data) return [];

    // Reverse to return chronological order (oldest -> newest) within the window.
    return data.map((row) => row.record as AgentMemoryRecord).reverse();
  }
}

