import type { AgentTask } from "../../core/types/task";

export class AxlBroadcaster {
  public async broadcast(task: AgentTask): Promise<AgentTask> {
    return task;
  }
}
