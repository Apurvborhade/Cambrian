import type { Request, Response } from "express";
import { taskService } from "../services/taskService";
import { axlBroadcaster } from "../../integrations/axl/broadcaster";

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

const buildTaskContext = (context: unknown) => {
  const providedContext = context && typeof context === "object" ? context as Record<string, unknown> : {};

  const taskContext: {
    poolAddress: string;
    roundWindowBlocks: number;
    priceReference?: number;
    notes?: string;
  } = {
    poolAddress: typeof providedContext.poolAddress === "string"
      ? providedContext.poolAddress
      : process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
    roundWindowBlocks: parsePositiveInteger(providedContext.roundWindowBlocks, 20)
  };

  if (typeof providedContext.priceReference === "number") {
    taskContext.priceReference = providedContext.priceReference;
  }

  if (typeof providedContext.notes === "string") {
    taskContext.notes = providedContext.notes;
  }

  return taskContext;
};

export const createTaskHandler = async (request: Request, response: Response): Promise<void> => {
  try {
    const task = taskService.createTask({
      id: typeof request.body?.id === "string" ? request.body.id : undefined,
      generation: parsePositiveInteger(request.body?.generation, 0),
      round: parsePositiveInteger(request.body?.round, 1),
      topic: typeof request.body?.topic === "string" ? request.body.topic : undefined,
      issuedAt: typeof request.body?.issuedAt === "string" ? request.body.issuedAt : undefined,
      context: buildTaskContext(request.body?.context)
    });

    // Broadcast the task via AXL (publish-once → agents subscribe)
    const published = await axlBroadcaster.broadcastTask(task);

    response.status(201).json(published);
  } catch (error) {
    sendError(response, error);
  }
};