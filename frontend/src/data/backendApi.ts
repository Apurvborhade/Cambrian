export interface BackendToolWeights {
  price_momentum: number;
  volume_signal: number;
  liquidity_depth: number;
  volatility_index: number;
  block_timing: number;
}

export interface BackendGenome {
  genome_id: string;
  token_id: string;
  nft_contract: string;
  fitness: number;
  generation: number;
  parent_ids: string[];
  mutation_seed: string;
  mutation_rate_at_birth: number;
  reasoning_strategy: string;
  tool_weights: BackendToolWeights;
  risk_threshold: number;
  memory_window: number;
  created_at_block: number;
  storage_key: string;
  nft_address: string;
}

export interface BackendArenaStateView {
  arenaId: string;
  size: number;
  generation: number;
  round: number;
  genomeIds: string[];
  updatedAt: string;
}

export interface BackendArenaDetails {
  state: BackendArenaStateView;
  genomes: BackendGenome[];
}

export interface BackendArenaCreateResult {
  arenaId: string;
  created: boolean;
  size: number;
  state: BackendArenaStateView | null;
  agents: BackendGenome[];
}

export interface BackendArenaRunRoundResult {
  arenaId: string;
  generation: number;
  round: number;
  ranked: Array<Record<string, unknown>>;
}

export interface BackendArenaRunResult {
  arenaId: string;
  generations: number;
  agents: BackendGenome[];
}

export interface BackendArenaSnapshotPayload {
  arenaId: string;
  state: BackendArenaStateView | null;
  agents: BackendGenome[];
}

export type BackendArenaEventType =
  | "arena.created"
  | "arena.state.updated"
  | "arena.round.started"
  | "arena.round.completed"
  | "arena.agent.evaluated"
  | "arena.child.planned"
  | "arena.child.created"
  | "arena.genome.minted"
  | "arena.genome.reused"
  | "arena.genome.burned";

export interface BackendArenaEvent<Type extends BackendArenaEventType = BackendArenaEventType> {
  type: Type;
  arenaId: string;
  timestamp: string;
  data: unknown;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const backendApi = {
  baseUrl: API_BASE_URL,
  health: () => requestJson<{ ok: boolean }>("/health"),
  createArena: (arenaId: string, size: number) =>
    requestJson<BackendArenaCreateResult>("/arenas", {
      method: "POST",
      body: JSON.stringify({ arenaId, size }),
    }),
  getArena: (arenaId: string) => requestJson<BackendArenaDetails>(`/arenas/${encodeURIComponent(arenaId)}`),
  getArenaState: (arenaId: string) =>
    requestJson<{ arenaId: string; state: BackendArenaStateView }>(`/arenas/${encodeURIComponent(arenaId)}/state`),
  getArenaAgents: (arenaId: string) =>
    requestJson<{ arenaId: string; agents: BackendGenome[] }>(`/arenas/${encodeURIComponent(arenaId)}/agents`),
  runArenaRound: (arenaId: string) =>
    requestJson<BackendArenaRunRoundResult>(`/arenas/${encodeURIComponent(arenaId)}/rounds`, {
      method: "POST",
    }),
  runArena: (arenaId: string, generations: number) =>
    requestJson<BackendArenaRunResult>(`/arenas/${encodeURIComponent(arenaId)}/run`, {
      method: "POST",
      body: JSON.stringify({ generations }),
    }),
  openArenaEvents: (
    arenaId: string,
    onEvent: (event: BackendArenaEvent | { type: "snapshot"; arenaId: string; timestamp: string; data: BackendArenaSnapshotPayload }) => void,
    onError?: (error: Event) => void,
  ) => {
    const source = new EventSource(`${API_BASE_URL}/arenas/${encodeURIComponent(arenaId)}/events`);

    const snapshotHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BackendArenaSnapshotPayload;
      onEvent({
        type: "snapshot",
        arenaId,
        timestamp: new Date().toISOString(),
        data,
      });
    };

    const eventNames: BackendArenaEventType[] = [
      "arena.created",
      "arena.state.updated",
      "arena.round.started",
      "arena.round.completed",
      "arena.agent.evaluated",
      "arena.child.planned",
      "arena.child.created",
      "arena.genome.minted",
      "arena.genome.reused",
      "arena.genome.burned",
    ];

    source.addEventListener("snapshot", snapshotHandler as EventListener);
    eventNames.forEach((name) => {
      source.addEventListener(name, ((event: MessageEvent) => {
        const data = JSON.parse(event.data) as BackendArenaEvent;
        onEvent(data);
      }) as EventListener);
    });

    if (onError) {
      source.onerror = onError;
    }

    return source;
  },
};
