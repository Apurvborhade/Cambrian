import { AxlBroadcaster } from "../../integrations/axl/broadcaster";
import { createAgentTask, type AgentTask } from "../../core/types/task";

export const broadcastTask = async (): Promise<AgentTask> => {
  const task = createAgentTask({
    id: "broadcast-task-1",
    context: {
      poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
      roundWindowBlocks: 20
    }
  });

  return new AxlBroadcaster().broadcast(task);
};
