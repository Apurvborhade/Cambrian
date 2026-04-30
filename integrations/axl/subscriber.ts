import type { AgentTask } from "../../core/types/task";
import { axlClient } from "./axlClient";

export type TaskHandler = (task: AgentTask) => Promise<void> | void;

class AxlSubscriber {
  public subscribe(topic: string, handler: TaskHandler): void {
    axlClient.subscribe(topic, (msg: any) => {
      // safe runtime check
      if (!msg || typeof msg !== "object") {
        console.warn("AXL subscriber received non-object message", msg);
        return;
      }

      try {
        // basic shape enforcement
        const task: AgentTask = {
          id: typeof msg.id === "string" ? msg.id : String(msg.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          generation: typeof msg.generation === "number" ? msg.generation : 0,
          round: typeof msg.round === "number" ? msg.round : 1,
          topic: typeof msg.topic === "string" ? msg.topic : topic,
          issuedAt: typeof msg.issuedAt === "string" ? msg.issuedAt : new Date().toISOString(),
          context: typeof msg.context === "object" && msg.context !== null ? msg.context : { poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool", roundWindowBlocks: 20 }
        } as AgentTask;

        void handler(task);
      } catch (err) {
        console.error("AXL subscriber handler error", err);
      }
    });
  }
}

export const axlSubscriber = new AxlSubscriber();
