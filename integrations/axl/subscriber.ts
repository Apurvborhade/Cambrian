import type { AgentTask } from "../../core/types/task";

export type TaskHandler = (task: AgentTask) => Promise<void> | void;

export class AxlSubscriber {
  public async subscribe(_topic: string, handler: TaskHandler): Promise<void> {
    await handler({
      id: "bootstrap-task",
      generation: 0,
      round: 1,
      topic: "darwin/task",
      issuedAt: new Date().toISOString(),
      context: {
        poolAddress: process.env.TARGET_POOL_ADDRESS ?? "",
        roundWindowBlocks: 20
      }
    });
  }
}
