import type { Request, Response } from "express";
import { agentRegistryService } from "../services/agentRegistryService";

const sendError = (response: Response, error: unknown, statusCode = 500): void => {
  const message = error instanceof Error ? error.message : String(error);
  response.status(statusCode).json({ error: message });
};

export const registerAgentHandler = (request: Request, response: Response): void => {
  try {
    const peerId = typeof request.body?.peerId === "string" ? request.body.peerId.trim() : "";
    const genomeId = typeof request.body?.genomeId === "string" ? request.body.genomeId.trim() : undefined;

    if (!peerId) {
      response.status(400).json({ error: "peerId is required." });
      return;
    }

    const existing = agentRegistryService.listAgents().find((agent) => agent.peerId === peerId);
    if (existing && existing.genomeId && genomeId && existing.genomeId !== genomeId) {
      console.warn(
        `[Agent] Duplicate peerId registration detected for ${peerId}. Existing genomeId=${existing.genomeId}, new genomeId=${genomeId}. This means the agents are sharing the same AXL node.`
      );
    }

    const agent = agentRegistryService.registerAgent(peerId, genomeId || undefined);
    response.status(201).json({ agent, updatedExisting: Boolean(existing) });
  } catch (error) {
    sendError(response, error);
  }
};

export const listAgentsHandler = (_request: Request, response: Response): void => {
  response.json({ agents: agentRegistryService.listAgents() });
};

export const heartbeatAgentHandler = (request: Request, response: Response): void => {
  try {
    const peerId = typeof request.body?.peerId === "string" ? request.body.peerId.trim() : "";
    const genomeId = typeof request.body?.genomeId === "string" ? request.body.genomeId.trim() : undefined;

    if (!peerId) {
      response.status(400).json({ error: "peerId is required for heartbeat." });
      return;
    }

    const existing = agentRegistryService.listAgents().find((agent) => agent.peerId === peerId);
    if (existing && existing.genomeId && genomeId && existing.genomeId !== genomeId) {
      console.warn(
        `[Agent] Duplicate peerId heartbeat detected for ${peerId}. Existing genomeId=${existing.genomeId}, new genomeId=${genomeId}.`
      );
    }

    const agent = agentRegistryService.registerAgent(peerId, genomeId || undefined);
    response.json({ ok: true, agent, updatedExisting: Boolean(existing) });
  } catch (err) {
    sendError(response, err);
  }
};