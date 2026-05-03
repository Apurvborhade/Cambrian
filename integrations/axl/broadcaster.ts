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

    // Send the task to every registered agent via AXL in parallel.
    // Using Promise.allSettled avoids failing the entire broadcast when one send fails
    // and makes delivery concurrent so agents receive the same task around the same time.
    const agents = agentRegistryService.listAgents();
    const sends = agents.map((a) => this.sendTaskToPeer(a.peerId, toPublish).then(() => ({ peerId: a.peerId, ok: true })).catch((err) => ({ peerId: a.peerId, ok: false, err })));

    const results = await Promise.allSettled(sends);

    // Log results succinctly
    const succeeded = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<any>).value.ok).length;
    const failed = results.length - succeeded;
    if (failed > 0) {
      console.warn(`[AXL] broadcastTask: ${failed} send(s) failed out of ${results.length}`);
    }

    console.log("[AXL] broadcastTask sent to", results.length, "agents (successful:", succeeded, ") for task", toPublish.id);
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
