import { createServer, type IncomingMessage, type ServerResponse } from "http";
import assert from "assert";
import { WebSocketServer, WebSocket } from "ws";
import { createAgentTask } from "../core/types/task";

const HOST = "127.0.0.1";
const PORT = 18080;

type SubscriptionMap = Map<string, Set<WebSocket>>;

const subscriptions: SubscriptionMap = new Map();

const addSubscriber = (topic: string, socket: WebSocket): void => {
  const set = subscriptions.get(topic) ?? new Set<WebSocket>();
  set.add(socket);
  subscriptions.set(topic, set);

  socket.on("close", () => {
    const existing = subscriptions.get(topic);
    if (!existing) {
      return;
    }
    existing.delete(socket);
    if (existing.size === 0) {
      subscriptions.delete(topic);
    }
  });
};

const broadcastToTopic = (topic: string, message: unknown): void => {
  const payload = JSON.stringify(message);
  const recipients = subscriptions.get(topic);
  if (!recipients) {
    return;
  }

  for (const ws of recipients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
};

const parseRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  if (request.method === "POST" && request.url === "/broadcast") {
    const raw = await parseRequestBody(request);
    let parsed: { topic?: string; message?: unknown };

    try {
      parsed = JSON.parse(raw) as { topic?: string; message?: unknown };
    } catch {
      response.statusCode = 400;
      response.end("invalid json");
      return;
    }

    if (!parsed.topic) {
      response.statusCode = 400;
      response.end("missing topic");
      return;
    }

    broadcastToTopic(parsed.topic, parsed.message);
    response.statusCode = 204;
    response.end();
    return;
  }

  response.statusCode = 404;
  response.end("not found");
};

const waitFor = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Timeout waiting for ${label}`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const run = async (): Promise<void> => {
  process.env.AXL_BROADCAST_URL = `http://${HOST}:${PORT}/broadcast`;
  process.env.AXL_WS_BASE = `ws://${HOST}:${PORT}/subscribe`;

  const server = createServer((req, res) => {
    void handler(req, res);
  });
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("error", (error) => {
      console.error("Mock AXL websocket error:", error);
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const url = request.url ?? "";
    const match = /^\/subscribe\/(.+)$/.exec(url);
    if (!match || !match[1]) {
      socket.destroy();
      return;
    }

    const topic = decodeURIComponent(match[1]);
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, request);
      addSubscriber(topic, ws);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, HOST, () => resolve());
  });

  const { axlBroadcaster } = await import("../integrations/axl/broadcaster");
  const { axlSubscriber } = await import("../integrations/axl/subscriber");
  const { axlClient } = await import("../integrations/axl/axlClient");

  try {
    const baseTask = createAgentTask({
      context: {
        poolAddress: "demo-pool",
        roundWindowBlocks: 20
      }
    });

    const taskReceived = new Promise<{ id: string; topic: string }>((resolve) => {
      axlSubscriber.subscribe("darwin/task", (task) => {
        resolve({ id: task.id, topic: task.topic });
      });
    });

    await sleep(100);
    const publishedTask = await axlBroadcaster.broadcastTask(baseTask);
    const gotTask = await waitFor(taskReceived, 3000, "task message");

    assert.strictEqual(gotTask.id, publishedTask.id, "task id should match the published task id");
    assert.strictEqual(gotTask.topic, "darwin/task", "task topic should be darwin/task");

    // TODO: Update result test for peer-to-peer model
    // const resultReceived = new Promise<{ id: string; timestamp: string }>((resolve) => {
    //   axlClient.startPolling("darwin/result", (msg: any) => {
    //     resolve({ id: msg.id, timestamp: msg.timestamp });
    //   });
    // });
    //
    // const result = {
    //   id: `result-${publishedTask.id}`,
    //   timestamp: new Date().toISOString(),
    //   taskId: publishedTask.id,
    //   status: "ok"
    // };
    //
    // await sleep(100);
    // // Results are now sent peer-to-peer via sendResultToPeer
    // const gotResult = await waitFor(resultReceived, 3000, "result message");
    // assert.strictEqual(gotResult.id, result.id, "result id should match");
    // assert.strictEqual(gotResult.timestamp, result.timestamp, "result timestamp should match");


    console.log("AXL integration test passed.");
  } finally {
    axlClient.closeAll();

    wss.clients.forEach((client: WebSocket) => {
      try {
        client.close();
      } catch {
        // ignore close failures during cleanup
      }
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    wss.close();
  }
};

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("AXL integration test failed:", message);
  process.exitCode = 1;
});
