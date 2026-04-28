import { subscribeArenaEvents, type ArenaEvent } from "../../core/arena/arenaEvents";
import { arenaService } from "./arenaService";

export interface ArenaSnapshotPayload {
  arenaId: string;
  state: Awaited<ReturnType<typeof arenaService.getArenaSnapshot>> extends infer T
    ? T extends { state: unknown }
      ? T["state"]
      : null
    : null;
  agents: Awaited<ReturnType<typeof arenaService.getArenaSnapshot>> extends infer T
    ? T extends { genomes: infer G }
      ? G
      : []
    : [];
}

export const arenaStreamService = {
  getSnapshot: async (arenaId: string): Promise<ArenaSnapshotPayload> => {
    const snapshot = await arenaService.getArenaSnapshot(arenaId);

    if (!snapshot) {
      return {
        arenaId,
        state: null,
        agents: []
      };
    }

    return {
      arenaId,
      state: snapshot.state,
      agents: snapshot.genomes
    };
  },
  subscribe: (arenaId: string, listener: (event: ArenaEvent) => void): (() => void) =>
    subscribeArenaEvents(arenaId, listener)
};