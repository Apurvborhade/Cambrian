import { setTimeout as delay } from "timers/promises";

type Handler = (msg: any) => void;

const BROADCAST_URL = process.env.AXL_BROADCAST_URL || "http://localhost:8080/broadcast";
const WS_BASE = process.env.AXL_WS_BASE || "ws://localhost:8080/subscribe";

function getWebSocketConstructor(): any {
  // Prefer global WebSocket (browser or newer Node), otherwise require 'ws'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = global as any;
  if (g.WebSocket) return g.WebSocket;
  // dynamic require to avoid breaking environments without 'ws'
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
    return require("ws");
  } catch (err) {
    throw new Error("WebSocket constructor not available. Please install 'ws' or run in an environment with global WebSocket.");
  }
}

export class AXLClient {
  private connections = new Map<
    string,
    {
      ws: any | null;
      handlers: Set<Handler>;
      backoff: number;
      reconnecting: boolean;
    }
  >();

  public async publish(topic: string, message: any): Promise<void> {
    const payload = { topic, message };
    try {
      const res = await fetch(BROADCAST_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("AXL publish failed", res.status, text);
        throw new Error(`AXL publish failed: ${res.status}`);
      }

      console.log("[AXL] published", topic, message?.id ?? "(no-id)");
    } catch (error) {
      console.error("[AXL] publish error", error);
      throw error;
    }
  }

  public subscribe(topic: string, handler: Handler): void {
    let entry = this.connections.get(topic);
    if (!entry) {
      entry = { ws: null, handlers: new Set<Handler>(), backoff: 1000, reconnecting: false };
      this.connections.set(topic, entry);
      this.connect(topic, entry).catch((err) => console.error("AXL connect failed", err));
    }

    entry.handlers.add(handler);
  }

  private async connect(topic: string, entry: { ws: any | null; handlers: Set<Handler>; backoff: number; reconnecting: boolean }) {
    const WebSocketCtor = getWebSocketConstructor();
    const url = `${WS_BASE}/${encodeURIComponent(topic)}`;

    try {
      // create socket
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ws = new WebSocketCtor(url);
      entry.ws = ws;
      entry.reconnecting = false;

      ws.onopen = () => {
        console.log(`[AXL] websocket open ${topic}`);
        entry.backoff = 1000;
      };

      ws.onmessage = (evt: any) => {
        const data = typeof evt.data === "string" ? evt.data : evt.data.toString();
        try {
          const parsed = JSON.parse(data);
          console.log(`[AXL] recv ${topic}`, parsed?.id ?? "(no-id)");
          for (const h of entry.handlers) {
            try {
              h(parsed);
            } catch (handlerErr) {
              console.error("AXL handler error", handlerErr);
            }
          }
        } catch (parseErr) {
          console.error("[AXL] invalid JSON message", data);
        }
      };

      ws.onclose = async (ev: any) => {
        console.warn(`[AXL] websocket closed ${topic} code=${ev?.code} reason=${ev?.reason}`);
        entry.ws = null;
        await this.scheduleReconnect(topic, entry);
      };

      ws.onerror = (err: any) => {
        console.error(`[AXL] websocket error ${topic}`, err?.message ?? err);
        try {
          ws.close?.();
        } catch {}
      };
    } catch (err) {
      console.error(`[AXL] connect exception ${topic}`, err);
      await this.scheduleReconnect(topic, entry);
    }
  }

  private async scheduleReconnect(topic: string, entry: { ws: any | null; handlers: Set<Handler>; backoff: number; reconnecting: boolean }) {
    if (entry.reconnecting) return;
    entry.reconnecting = true;
    const waitMs = entry.backoff;
    console.log(`[AXL] reconnecting ${topic} in ${waitMs}ms`);
    await delay(waitMs);
    entry.backoff = Math.min(entry.backoff * 2, 30000);
    entry.reconnecting = false;
    if (entry.handlers.size === 0) {
      // no interested handlers, skip
      return;
    }

    try {
      await this.connect(topic, entry);
    } catch (err) {
      console.error("[AXL] reconnect failed", err);
      // schedule again
      await this.scheduleReconnect(topic, entry);
    }
  }
}

// single shared client
export const axlClient = new AXLClient();
