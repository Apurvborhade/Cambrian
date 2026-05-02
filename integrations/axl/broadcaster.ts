import type { AgentTask } from "../../core/types/task";
import { axlClient } from "./axlClient";
import { agentRegistryService } from "../../backend/services/agentRegistryService";

export class AxlBroadcaster {
  /**
   * Send a task to a specific peer (agent).
   * For now, this is used for direct agent communication.
   * In a real scenario, you'd have a registry of agent peer IDs.
   */
  public async sendTaskToPeer(agentPeerId: string, task: AgentTask): Promise<AgentTask> {
    const toSend = {
      ...task,
      id: task.id ?? (typeof (global as any).crypto?.randomUUID === "function" ? (global as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      issuedAt: task.issuedAt ?? new Date().toISOString()
    } as AgentTask;

    await axlClient.send(agentPeerId, toSend);
    return toSend;
  }

  /**
   * Broadcast a task to all listening agents.
   * Since AXL doesn't have true pub/sub, this stores the task for polling agents.
   * Agents poll /recv to get new tasks.
   * For MVP: you can send to a known agent list, or have a separate broadcast queue.
   */
  public async broadcastTask(task: AgentTask): Promise<AgentTask> {
    const toPublish = {
      ...task,
      id: task.id ?? (typeof (global as any).crypto?.randomUUID === "function" ? (global as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      issuedAt: task.issuedAt ?? new Date().toISOString()
    } as AgentTask;

    // Send the task to every registered agent via AXL
    const agents = agentRegistryService.listAgents();
    for (const a of agents) {
      try {
        await this.sendTaskToPeer(a.peerId, toPublish);
      } catch (err) {
        console.warn("[AXL] broadcastTask failed to send to", a.peerId, err);
      }
    }

    console.log("[AXL] broadcastTask sent to", agents.length, "agents for task", toPublish.id);
    return toPublish;
  }

  /**
   * Send a result message back to a specific peer (e.g., the orchestrator).
   */
  public async sendResultToPeer(peerIdor: string, result: unknown): Promise<void> {
    await axlClient.send(peerIdor, result);
  }
}

export const axlBroadcaster = new AxlBroadcaster();
