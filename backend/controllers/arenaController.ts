import type { Request, Response } from "express";
import { arenaService } from "../services/arenaService";

const normalizeArenaId = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
};

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
};

const sendError = (response: Response, error: unknown, statusCode = 500): void => {
  const message = error instanceof Error ? error.message : String(error);
  response.status(statusCode).json({ error: message });
};

export const healthHandler = (_request: Request, response: Response): void => {
  response.json({ ok: true });
};

export const createArenaHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = String(request.body?.arenaId ?? "").trim();
    const size = parsePositiveInteger(request.body?.size, 5);

    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const result = await arenaService.createArena(arenaId, size);
    response.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const getArenaHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = normalizeArenaId(request.params.arenaId);
    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const arena = await arenaService.getArena(arenaId);
    if (!arena) {
      response.status(404).json({ error: `Arena ${arenaId} not found.` });
      return;
    }

    response.json(arena);
  } catch (error) {
    sendError(response, error);
  }
};

export const getArenaStateHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = normalizeArenaId(request.params.arenaId);
    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const state = await arenaService.getArenaState(arenaId);
    if (!state) {
      response.status(404).json({ error: `Arena ${arenaId} not found.` });
      return;
    }

    response.json({ arenaId, state });
  } catch (error) {
    sendError(response, error);
  }
};

export const getArenaAgentsHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = normalizeArenaId(request.params.arenaId);
    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const agents = await arenaService.getArenaAgents(arenaId);
    response.json({ arenaId, agents });
  } catch (error) {
    sendError(response, error);
  }
};

export const runArenaRoundHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = normalizeArenaId(request.params.arenaId);
    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const result = await arenaService.runArenaRound(arenaId);
    response.json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const runArenaHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const arenaId = normalizeArenaId(request.params.arenaId);
    if (!arenaId) {
      response.status(400).json({ error: "arenaId is required." });
      return;
    }

    const generations = parsePositiveInteger(request.body?.generations, 1);
    const result = await arenaService.runArena(arenaId, generations);
    response.json({ arenaId, generations, agents: result });
  } catch (error) {
    sendError(response, error);
  }
};