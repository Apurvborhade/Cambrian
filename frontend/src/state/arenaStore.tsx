import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  backendApi,
  type BackendArenaEvent,
  type BackendArenaEventType,
  type BackendArenaSnapshotPayload,
  type BackendGenome,
  type BackendToolWeights,
} from "../data/backendApi";
import type { Genome, GenerationEvent, TournamentState } from "../data/domain";

export type TimelineRow = {
  id: string;
  type: string;
  arenaId: string;
  timestamp: string;
  agent_id: string;
  generation: number;
  round: number;
  block_number: number;
  data: Record<string, unknown>;
};

export type CreateArenaResult =
  | { ok: true; created: boolean; arenaId: string; size: number }
  | { ok: false };

type ArenaContextValue = {
  arenaId: string;
  setArenaId: (arenaId: string) => void;
  arenaState: BackendArenaSnapshotPayload["state"] | null;
  allGenomes: Genome[];
  currentGenomes: Genome[];
  currentGenome: Genome | null;
  selectedGenomeId: string | null;
  setSelectedGenomeId: (genomeId: string | null) => void;
  timelineRows: TimelineRow[];
  generationEvents: GenerationEvent[];
  tournament: TournamentState;
  backendHealthy: boolean | null;
  backendLatencyMs: number | null;
  loading: boolean;
  error: string | null;
  runBusy: boolean;
  createArena: (arenaId?: string, size?: number) => Promise<CreateArenaResult>;
  runArena: (generations?: number) => Promise<void>;
  runRound: () => Promise<void>;
  refresh: () => Promise<void>;
};

const DEFAULT_ARENA_ID = "darwin-protocol";
const DEFAULT_ARENA_SIZE = 5;
const DEFAULT_ROUNDS_PER_GENERATION = 5;
const DEFAULT_SURVIVORS = 2;
const STORAGE_KEY = "darwin.frontend.arenaId";

const ArenaContext = createContext<ArenaContextValue | null>(null);

const cloneWeights = (weights: BackendToolWeights): BackendToolWeights => ({ ...weights });

const shortHash = (value: string) => value.replace(/^0x/, "").slice(-6).toUpperCase();

const estimateStatus = (genome: BackendGenome, selectedGenomeId: string | null, burnedIds: Set<string>): Genome["status"] => {
  if (burnedIds.has(genome.genome_id)) {
    return "DEAD";
  }

  if (selectedGenomeId === genome.genome_id) {
    return "SELECTED";
  }

  if (genome.generation > 0) {
    return "EVOLVED";
  }

  return "ALIVE";
};

const backendGenomeToUi = (
  genome: BackendGenome,
  options: {
    selectedGenomeId: string | null;
    burnedIds: Set<string>;
    history: number[];
  },
): Genome => ({
  genome_id: genome.genome_id,
  generation: genome.generation,
  parent_ids: [...genome.parent_ids],
  mutation_seed: genome.mutation_seed,
  mutation_rate_at_birth: genome.mutation_rate_at_birth,
  reasoning_strategy: genome.reasoning_strategy,
  tool_weights: cloneWeights(genome.tool_weights),
  risk_threshold: genome.risk_threshold,
  memory_window: genome.memory_window,
  created_at_block: genome.created_at_block,
  storage_key: genome.storage_key,
  nft_address: genome.nft_address,
  status: estimateStatus(genome, options.selectedGenomeId, options.burnedIds),
  fitness_score: Number(genome.fitness.toFixed(2)),
  fitness_history: options.history,
});

const createTimelineRow = (
  event: BackendArenaEvent | { type: "snapshot"; arenaId: string; timestamp: string; data: BackendArenaSnapshotPayload },
  index: number,
): TimelineRow => {
  if (event.type === "snapshot") {
    const agent = event.data.agents[0];
    return {
      id: `${event.type}-${event.arenaId}-${index}`,
      type: event.type,
      arenaId: event.arenaId,
      timestamp: event.timestamp,
      agent_id: agent?.genome_id ?? event.arenaId,
      generation: event.data.state?.generation ?? 0,
      round: event.data.state?.round ?? 0,
      block_number: event.data.state?.generation ?? 0,
      data: {
        state: event.data.state,
        agents: event.data.agents,
      },
    };
  }

  const data = event.data as Record<string, unknown>;
  const genome = (data.genome as BackendGenome | undefined) ?? (data.child as BackendGenome | undefined) ?? null;
  const state = (data.state as BackendArenaSnapshotPayload["state"] | undefined) ?? null;
  const resultPayload = data.result as { generation?: number; round?: number; ranked?: unknown[] } | undefined;
  const round =
    typeof data.round === "number"
      ? data.round
      : typeof resultPayload?.round === "number"
        ? resultPayload.round
        : state?.round ?? 0;
  const generation =
    typeof data.generation === "number"
      ? data.generation
      : typeof resultPayload?.generation === "number"
        ? resultPayload.generation
        : genome?.generation ?? state?.generation ?? 0;
  const agentId =
    typeof data.agentId === "string"
      ? data.agentId
      : genome?.genome_id ?? event.arenaId;
  const blockNumber =
    typeof data.block_number === "number"
      ? data.block_number
      : typeof data.blockNumber === "number"
        ? data.blockNumber
        : genome?.created_at_block ?? generation;

  return {
    id: `${event.type}-${event.arenaId}-${index}`,
    type: event.type,
    arenaId: event.arenaId,
    timestamp: event.timestamp,
    agent_id: agentId,
    generation,
    round,
    block_number: blockNumber,
    data,
  };
};

const toGenerationEvent = (row: TimelineRow): GenerationEvent => ({
  event_type: row.type,
  agent_id: row.agent_id,
  generation: row.generation,
  round: row.round,
  block_number: row.block_number,
  timestamp: row.timestamp,
  data: row.data,
});

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const deriveGenerationFitness = (genomes: Genome[], generationCap: number) => {
  const values: number[] = [];

  for (let generation = 0; generation <= generationCap; generation += 1) {
    const generationGenomes = genomes.filter((genome) => genome.generation === generation);
    if (!generationGenomes.length) {
      continue;
    }

    values.push(Number(average(generationGenomes.map((genome) => genome.fitness_score)).toFixed(2)));
  }

  return values;
};

const buildGenomeHistory = (rows: TimelineRow[], genomeId: string) =>
  rows
    .filter((row) => row.agent_id === genomeId && row.type === "arena.agent.evaluated")
    .map((row) => {
      const fitness = row.data.fitness;
      if (typeof fitness === "number") {
        return Number(fitness.toFixed(2));
      }
      if (typeof row.data.score === "number") {
        return Number(row.data.score.toFixed(2));
      }
      return null;
    })
    .filter((value): value is number => value !== null);

const loadArenaSnapshot = async (targetArenaId: string) => {
  const [stateResult, agentsResult] = await Promise.allSettled([
    backendApi.getArenaState(targetArenaId),
    backendApi.getArenaAgents(targetArenaId),
  ]);

  const state = stateResult.status === "fulfilled" ? stateResult.value.state : null;
  const agents = agentsResult.status === "fulfilled" ? agentsResult.value.agents : [];

  return { state, agents };
};

const emptyArenaSnapshot = () => ({
  arenaState: null as BackendArenaSnapshotPayload["state"] | null,
  genomesById: {} as Record<string, BackendGenome>,
  selectedGenomeId: null as string | null,
  timelineRows: [] as TimelineRow[],
  burnedIds: new Set<string>(),
});

export function ArenaProvider({ children }: { children: ReactNode }) {
  const [arenaId, setArenaIdState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_ARENA_ID;
    }

    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ARENA_ID;
  });
  const [arenaState, setArenaState] = useState<BackendArenaSnapshotPayload["state"] | null>(null);
  const [genomesById, setGenomesById] = useState<Record<string, BackendGenome>>({});
  const [selectedGenomeId, setSelectedGenomeId] = useState<string | null>(null);
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([]);
  const [burnedIds, setBurnedIds] = useState<Set<string>>(new Set());
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const bootedRef = useRef(false);

  const persistArenaId = useCallback((value: string) => {
    setArenaIdState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  }, []);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const applySnapshot = useCallback((snapshot: { state: BackendArenaSnapshotPayload["state"] | null; agents: BackendGenome[] }) => {
    if (!snapshot.state || !snapshot.agents.length) {
      const empty = emptyArenaSnapshot();
      setArenaState(empty.arenaState);
      setGenomesById(empty.genomesById);
      setSelectedGenomeId(empty.selectedGenomeId);
      setTimelineRows(empty.timelineRows);
      setBurnedIds(empty.burnedIds);
      return;
    }

    setArenaState(snapshot.state);
    setGenomesById(
      snapshot.agents.reduce<Record<string, BackendGenome>>((next, genome) => {
        next[genome.genome_id] = genome;
        return next;
      }, {}),
    );
    setSelectedGenomeId(snapshot.agents[0]?.genome_id ?? null);
    // Keep timelineRows: refresh() re-fetches state after runArena/runRound; clearing here
    // wiped all SSE-backed activity (child created, rounds, etc.) and left the log empty.
    setBurnedIds(new Set());
  }, []);

  const upsertGenomes = useCallback((genomes: BackendGenome[]) => {
    if (!genomes.length) {
      return;
    }

    setGenomesById((current) => {
      const next = { ...current };
      genomes.forEach((genome) => {
        next[genome.genome_id] = genome;
      });
      return next;
    });
  }, []);

  const ingestEvent = useCallback(
    (event: BackendArenaEvent | { type: "snapshot"; arenaId: string; timestamp: string; data: BackendArenaSnapshotPayload }) => {
      setTimelineRows((current) => [...current, createTimelineRow(event, current.length)]);

      if (event.type === "snapshot") {
        setArenaState(event.data.state);
        upsertGenomes(event.data.agents);
        if (!selectedGenomeId) {
          setSelectedGenomeId(event.data.agents[0]?.genome_id ?? null);
        }
        return;
      }

      const data = event.data as Record<string, unknown>;

      if (event.type === "arena.created") {
        const state = data.state as BackendArenaSnapshotPayload["state"] | undefined;
        const agents = (data.agents as BackendGenome[] | undefined) ?? [];
        if (state) {
          setArenaState(state);
        }
        if (agents.length) {
          upsertGenomes(agents);
          setSelectedGenomeId((current) => current ?? agents[0]?.genome_id ?? null);
        }
        return;
      }

      if (event.type === "arena.state.updated") {
        const state = data.state as BackendArenaSnapshotPayload["state"] | undefined;
        if (state) {
          setArenaState(state);
        }
        return;
      }

      if (event.type === "arena.agent.evaluated") {
        const genome = data.genome as BackendGenome | undefined;
        const fitness = typeof data.fitness === "number" ? data.fitness : undefined;
        if (genome) {
          upsertGenomes([
            {
              ...genome,
              fitness: fitness ?? genome.fitness,
            },
          ]);
        }
        return;
      }

      if (
        event.type === "arena.child.created" ||
        event.type === "arena.genome.minted" ||
        event.type === "arena.genome.reused"
      ) {
        const genome = (data.child as BackendGenome | undefined) ?? (data.genome as BackendGenome | undefined);
        if (genome) {
          upsertGenomes([genome]);
          if (event.type === "arena.child.created") {
            setSelectedGenomeId(genome.genome_id);
          }
        }
        return;
      }

      if (event.type === "arena.genome.burned") {
        const genome = data.genome as BackendGenome | undefined;
        if (genome) {
          setBurnedIds((current) => new Set(current).add(genome.genome_id));
          upsertGenomes([
            {
              ...genome,
              fitness: 0,
            },
          ]);
        }
      }
    },
    [selectedGenomeId, upsertGenomes],
  );

  const refresh = useCallback(async () => {
    const started = performance.now();
    try {
      const health = await backendApi.health();
      setBackendHealthy(Boolean(health.ok));
      setBackendLatencyMs(Math.round(performance.now() - started));
    } catch {
      setBackendHealthy(false);
      setBackendLatencyMs(null);
    }

    try {
      const snapshot = await loadArenaSnapshot(arenaId);
      applySnapshot(snapshot);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [arenaId, applySnapshot]);

  const connectStream = useCallback(
    (nextArenaId: string) => {
      closeStream();
      const source = backendApi.openArenaEvents(
        nextArenaId,
        ingestEvent,
        () => setError("Arena event stream disconnected."),
      );
      streamRef.current = source;
    },
    [closeStream, ingestEvent],
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);

      const started = performance.now();
      try {
        const health = await backendApi.health();
        if (!cancelled) {
          setBackendHealthy(Boolean(health.ok));
          setBackendLatencyMs(Math.round(performance.now() - started));
        }
      } catch {
        if (!cancelled) {
          setBackendHealthy(false);
          setBackendLatencyMs(null);
        }
      }

      try {
        const snapshot = await loadArenaSnapshot(arenaId);
        if (cancelled) {
          return;
        }

        if (snapshot.state && snapshot.agents.length) {
          applySnapshot(snapshot);
          setError(null);
          connectStream(arenaId);
          return;
        }
        applySnapshot(snapshot);
        setError(null);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setError(message);
      }
      finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!bootedRef.current) {
      bootedRef.current = true;
      void boot();
    }

    return () => {
      cancelled = true;
      closeStream();
    };
  }, [arenaId, applySnapshot, closeStream, connectStream]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, arenaId);
    }
  }, [arenaId]);

  const createArena = useCallback(
    async (nextArenaId = arenaId, size = DEFAULT_ARENA_SIZE): Promise<CreateArenaResult> => {
      setLoading(true);
      try {
        const result = await backendApi.createArena(nextArenaId, size);
        if (result.state && result.agents.length) {
          persistArenaId(nextArenaId);
          setTimelineRows([]);
          applySnapshot({ state: result.state, agents: result.agents });
          setError(null);
          connectStream(nextArenaId);
          return {
            ok: true,
            created: result.created,
            arenaId: nextArenaId,
            size: result.size ?? size,
          };
        }
        throw new Error("Backend createArena returned an empty arena.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : String(createError));
        return { ok: false };
      } finally {
        setLoading(false);
      }
    },
    [arenaId, applySnapshot, connectStream, persistArenaId],
  );

  const runArena = useCallback(
    async (generations = 1) => {
      setRunBusy(true);
      try {
        await backendApi.runArena(arenaId, generations);
        await refresh();
      } catch (runError) {
        setError(runError instanceof Error ? runError.message : String(runError));
      } finally {
        setRunBusy(false);
      }
    },
    [arenaId, refresh],
  );

  const runRound = useCallback(async () => {
    setRunBusy(true);
    try {
      await backendApi.runArenaRound(arenaId);
      await refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setRunBusy(false);
    }
  }, [arenaId, refresh]);

  const allGenomes = useMemo(() => {
    return Object.values(genomesById)
      .map((genome) =>
        backendGenomeToUi(genome, {
          selectedGenomeId,
          burnedIds,
          history: buildGenomeHistory(timelineRows, genome.genome_id),
        }),
      )
      .sort((left, right) => right.fitness_score - left.fitness_score || left.genome_id.localeCompare(right.genome_id));
  }, [burnedIds, genomesById, selectedGenomeId, timelineRows]);

  const currentGenomes = useMemo(() => {
    const ids = arenaState?.genomeIds ?? [];
    if (!ids.length) {
      return allGenomes;
    }

    return ids
      .map((genomeId) => allGenomes.find((genome) => genome.genome_id === genomeId))
      .filter((genome): genome is Genome => Boolean(genome));
  }, [allGenomes, arenaState?.genomeIds]);

  const currentGenome = useMemo(() => {
    return allGenomes.find((genome) => genome.genome_id === selectedGenomeId) ?? allGenomes[0] ?? null;
  }, [allGenomes, selectedGenomeId]);

  useEffect(() => {
    const hasGenomes = Object.keys(genomesById).length > 0;
    if (!error && hasGenomes) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [error, genomesById, refresh]);

  const tournament = useMemo<TournamentState>(() => {
    const genomes = currentGenomes.length ? currentGenomes : allGenomes;
    const currentGeneration = arenaState?.generation ?? genomes.reduce((max, genome) => Math.max(max, genome.generation), 0);
    const currentRound = arenaState?.round ?? Math.max(1, currentGenome?.fitness_history.length ?? 0);
    const populationSize = arenaState?.size ?? genomes.length;
    const aliveCount = genomes.filter((genome) => genome.status !== "DEAD").length;

    return {
      current_generation: currentGeneration,
      current_round: currentRound,
      rounds_per_generation: DEFAULT_ROUNDS_PER_GENERATION,
      population_size: populationSize,
      survivors: Math.min(DEFAULT_SURVIVORS, Math.max(1, aliveCount || genomes.length || 1)),
      agents: genomes,
      generation_fitness_avg: deriveGenerationFitness(genomes, currentGeneration),
    };
  }, [allGenomes, arenaState?.generation, arenaState?.round, arenaState?.size, currentGenome, currentGenomes]);

  const generationEvents = useMemo<GenerationEvent[]>(() => timelineRows.map(toGenerationEvent), [timelineRows]);

  const value = useMemo<ArenaContextValue>(
    () => ({
      arenaId,
      setArenaId: persistArenaId,
      arenaState,
      allGenomes,
      currentGenomes,
      currentGenome,
      selectedGenomeId,
      setSelectedGenomeId,
      timelineRows,
      generationEvents,
      tournament,
      backendHealthy,
      backendLatencyMs,
      loading,
      error,
      runBusy,
      createArena,
      runArena,
      runRound,
      refresh,
    }),
    [
      allGenomes,
      arenaId,
      arenaState,
      backendHealthy,
      backendLatencyMs,
      createArena,
      currentGenome,
      currentGenomes,
      error,
      generationEvents,
      loading,
      persistArenaId,
      refresh,
      runArena,
      runBusy,
      runRound,
      selectedGenomeId,
      setSelectedGenomeId,
      timelineRows,
      tournament,
    ],
  );

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArenaStore(): ArenaContextValue {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error("useArenaStore must be used within ArenaProvider");
  }

  return context;
}

export function useArenaDerivedLabel(value: string) {
  return shortHash(value);
}
