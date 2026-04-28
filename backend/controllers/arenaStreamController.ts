import type { Request, Response } from "express";
import { arenaStreamService } from "../services/arenaStreamService";

const normalizeArenaId = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
};

const writeSseEvent = (response: Response, event: string, data: unknown): void => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const streamArenaEventsHandler = async (request: Request, response: Response): Promise<void> => {
  const arenaId = normalizeArenaId(request.params.arenaId);
  if (!arenaId) {
    response.status(400).json({ error: "arenaId is required." });
    return;
  }

  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders?.();

  response.write(`retry: 3000\n\n`);

  const snapshot = await arenaStreamService.getSnapshot(arenaId);
  writeSseEvent(response, "snapshot", snapshot);

  const keepAlive = setInterval(() => {
    response.write(`: keep-alive\n\n`);
  }, 15000);

  const unsubscribe = arenaStreamService.subscribe(arenaId, (event) => {
    writeSseEvent(response, event.type, event);
  });

  request.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
    response.end();
  });
};