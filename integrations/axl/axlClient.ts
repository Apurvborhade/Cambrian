/**
 * AXL Client for peer-to-peer task communication via Gensyn/Yggdrasil network.
 * 
 * AXL node exposes HTTP API on port 9002 with endpoints:
 * - GET /topology         - get local node's peer ID and network state
 * - POST /send            - send raw message to a remote peer
 * - GET /recv             - poll for inbound messages
 * - POST /mcp/{id}/{svc}  - JSON-RPC to remote MCP services
 * - POST /a2a/{id}        - JSON-RPC to remote A2A services
 */

const AXL_NODE_URL = process.env.AXL_NODE_URL || "http://localhost:9002";

type Handler = (message: any) => void | Promise<void>;

export interface TopologyResponse {
  our_ipv6: string;
  our_public_key: string;
  peers: string[];
  tree: string[];
}

export class AXLClient {
  private nodeUrl: string;
  private pollIntervals = new Map<string, NodeJS.Timeout>();
  private isPolling = new Map<string, boolean>();
  private lastPollTime = new Map<string, number>();

  constructor() {
    this.nodeUrl = AXL_NODE_URL;
  }

  /**
   * Get the local node's topology (peer ID, network state).
   */
  public async getTopology(): Promise<TopologyResponse> {
    try {
      const res = await fetch(`${this.nodeUrl}/topology`, { method: "GET" });
      if (!res.ok) throw new Error(`AXL topology failed: ${res.status}`);
      return res.json() as Promise<TopologyResponse>;
    } catch (err) {
      console.error("[AXL] getTopology error:", err);
      throw err;
    }
  }

  /**
   * Send a message to a remote peer.
   * destinationPeerId: hex-encoded ed25519 public key (64 chars)
   * message: raw data (Buffer or string or object that will be JSON stringified)
   */
  public async send(destinationPeerId: string, message: any): Promise<number> {
    let body: string;
    if (typeof message === "string") {
      body = message;
    } else if (Buffer.isBuffer(message)) {
      body = message.toString();
    } else {
      // Assume object, stringify it
      body = JSON.stringify(message);
    }

    try {
      const res = await fetch(`${this.nodeUrl}/send`, {
        method: "POST",
        headers: { "X-Destination-Peer-Id": destinationPeerId },
        body,
      });

      if (!res.ok) throw new Error(`AXL send failed: ${res.status}`);

      const sentBytes = res.headers.get("X-Sent-Bytes");
      console.log(`[AXL] sent ${sentBytes} bytes to ${destinationPeerId.substring(0, 16)}...`);
      return sentBytes ? parseInt(sentBytes, 10) : 0;
    } catch (err) {
      console.error("[AXL] send error:", err);
      throw err;
    }
  }

  /**
   * Poll for inbound messages.
   * Returns null if queue is empty (204 No Content).
   * Returns { fromPeerId, data } if a message is received.
   */
  public async recv(): Promise<{ fromPeerId: string; data: string } | null> {
    try {
      const res = await fetch(`${this.nodeUrl}/recv`, { method: "GET" });
      
      if (res.status === 204) {
        // No content - queue is empty
        return null;
      }
      
      if (!res.ok) throw new Error(`AXL recv failed: ${res.status}`);

      const fromPeerId = res.headers.get("X-From-Peer-Id");
      const data = await res.text();
      
      if (fromPeerId) {
        console.log(`[AXL] received message from ${fromPeerId.substring(0, 16)}...`);
        return { fromPeerId, data };
      }
      
      return null;
    } catch (err) {
      console.error("[AXL] recv error:", err);
      throw err;
    }
  }

  /**
   * Start polling for inbound messages and invoke handler on each.
   * topic param is used for logging/identification only (AXL doesn't have topics in /send/recv).
   * pollIntervalMs: polling interval in milliseconds (default 1000ms).
   */
  public startPolling(topic: string, handler: Handler, pollIntervalMs: number = 1000): void {
    if (this.isPolling.get(topic)) {
      console.log(`[AXL] already polling for "${topic}"`);
      return;
    }

    this.isPolling.set(topic, true);
    console.log(`[AXL] started polling for "${topic}" (interval: ${pollIntervalMs}ms)`);

    const poll = async () => {
      try {
        const msg = await this.recv();
        if (msg) {
          try {
            // Try to parse as JSON
            const parsed = JSON.parse(msg.data);
            await handler(parsed);
          } catch (parseErr) {
            // Not JSON; pass as raw message
            await handler({
              raw: msg.data,
              fromPeerId: msg.fromPeerId,
              isRaw: true
            });
          }
        }
      } catch (err) {
        // Log but don't crash; keep polling
        console.error(`[AXL] recv error (will retry):`, err);
      }
    };

    // Execute immediate poll
    poll().catch((err) => console.error(`[AXL] initial poll failed:`, err));
    
    // Set interval for subsequent polls
    const interval = setInterval(poll, pollIntervalMs);
    this.pollIntervals.set(topic, interval);
    this.lastPollTime.set(topic, Date.now());
  }

  /**
   * Stop polling for inbound messages.
   */
  public stopPolling(topic: string): void {
    const interval = this.pollIntervals.get(topic);
    if (interval) {
      clearInterval(interval as unknown as NodeJS.Timeout);
      this.pollIntervals.delete(topic);
    }
    this.isPolling.delete(topic);
    this.lastPollTime.delete(topic);
    console.log(`[AXL] stopped polling for "${topic}"`);
  }

  /**
   * Close all polling and clean up.
   */
  public closeAll(): void {
    for (const topic of Array.from(this.pollIntervals.keys())) {
      this.stopPolling(topic);
    }
    console.log("[AXL] closed all polling");
  }
}

// Single shared client instance
export const axlClient = new AXLClient();
