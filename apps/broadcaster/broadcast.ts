import { AxlBroadcaster } from "../../integrations/axl/broadcaster";
import type { AgentTask } from "../../core/types/task";

export const broadcastTask = async (): Promise<AgentTask> => {
  const task: AgentTask = {
    id: "broadcast-task-1",
    generation: 0,
    round: 1,
    topic: "darwin/task",
    issuedAt: new Date().toISOString(),
    context: {
      poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
      roundWindowBlocks: 20
    }
  };

  return new AxlBroadcaster().broadcast(task);
};
