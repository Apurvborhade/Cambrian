import type { AgentTask } from "../../core/types/task";
import { axlClient } from "./axlClient";

export class AxlBroadcaster {
  public async broadcastTask(task: AgentTask): Promise<AgentTask> {
    const toPublish = {
      ...task,
      id: task.id ?? (typeof (global as any).crypto?.randomUUID === "function" ? (global as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      issuedAt: task.issuedAt ?? new Date().toISOString()
    } as AgentTask;

    await axlClient.publish("darwin/task", toPublish);
    return toPublish;
  }

  public async publishResult(result: unknown): Promise<void> {
    await axlClient.publish("darwin/result", result);
  }
}

export const axlBroadcaster = new AxlBroadcaster();
