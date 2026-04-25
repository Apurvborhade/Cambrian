import type { ArenaManager } from "../../core/arena/arenaManager";
import { ProcessManager } from "./processManager";

export const startEvolutionLifecycle = async (arena: ArenaManager) => {
  const processManager = new ProcessManager();
  arena.start();
  processManager.spawn("agent-genesis-a", "node dist/apps/agent/index.js genesis-a");
  arena.advanceRound();

  return {
    arena: arena.snapshot(),
    processes: processManager.stopAll()
  };
};
