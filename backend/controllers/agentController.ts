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

    const agent = agentRegistryService.registerAgent(peerId, genomeId || undefined);
    response.status(201).json(agent);
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

    const agent = agentRegistryService.registerAgent(peerId, genomeId || undefined);
    response.json({ ok: true, agent });
  } catch (err) {
    sendError(response, err);
  }
};