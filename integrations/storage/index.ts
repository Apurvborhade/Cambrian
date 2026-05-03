import { HybridStorageAdapter } from "./hybrid";
import { ZeroGStorageAdapter } from "../0g/storage";
import { env } from "../../config/env";

export type StorageAdapter = Pick<
  ZeroGStorageAdapter,
  "setGenome" | "getGenome" | "appendMemory" | "getRecentMemory" | "setJson" | "getJson" | "isGenomeDeleted" | "deleteGenome"
>;

export const createStorageAdapter = (): StorageAdapter => {
  // If Supabase creds are configured, keep the arena running by falling back when 0G storage stalls.
  if (env.supabaseUrl.trim() && env.supabaseServiceRoleKey.trim()) {
    return new HybridStorageAdapter();
  }

  return new ZeroGStorageAdapter();
};

