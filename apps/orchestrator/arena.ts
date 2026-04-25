import { createArenaConfig } from "../../core/arena/arenaConfig";
import { ArenaManager } from "../../core/arena/arenaManager";

export const createArena = (): ArenaManager => new ArenaManager(createArenaConfig());
