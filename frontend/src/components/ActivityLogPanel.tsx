import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendGenome } from "../data/backendApi";
import type { TimelineRow } from "../state/arenaStore";
import { shortGenomeLabel } from "../utils/genomeShort";

export type ActivityLineKind =
  | "SURVIVOR"
  | "ELIMINATED"
  | "CHILD"
  | "MUTATION"
  | "ROUND_END"
  | "ROUND_START"
  | "ARENA_READY"
  | "ERROR";

export type ActivityLine = {
  id: string;
  kind: ActivityLineKind;
  genLabel: string;
  body: string;
};

const padGen = (generation: number) => String(generation).padStart(2, "0");

function weightMutationLines(child: BackendGenome, parents: { best: BackendGenome; second: BackendGenome }): ActivityLine[] {
  const labels = [
    ["PRICE_MOMENTUM", "price_momentum"],
    ["VOLUME_SIGNAL", "volume_signal"],
    ["LIQUIDITY_DEPTH", "liquidity_depth"],
  ] as const;

  const lines: ActivityLine[] = [];
  const mid = (key: keyof BackendGenome["tool_weights"]) =>
    (parents.best.tool_weights[key] + parents.second.tool_weights[key]) / 2;
  let i = 0;
  for (const [label, key] of labels) {
    const delta = child.tool_weights[key] - mid(key);
    if (Math.abs(delta) < 1e-6) continue;
    const sign = delta > 0 ? "+" : "";
    lines.push({
      id: `mutation-${child.genome_id}-${i}`,
      kind: "MUTATION",
      genLabel: `[GEN_${padGen(child.generation)}]`,
      body: `MUTATION   :: ${label}  ${sign}${delta.toFixed(2)}`,
    });
    i += 1;
  }
  return lines;
}

function rowsToActivityLines(rows: TimelineRow[], error: string | null, arenaSize: number | null): ActivityLine[] {
  const lines: ActivityLine[] = [];

  if (error?.trim()) {
    lines.push({
      id: `err-${error.slice(0, 24)}`,
      kind: "ERROR",
      genLabel: "",
      body: `ERROR :: ${error.trim()}`,
    });
  }

  for (const row of rows) {
    const gen = row.generation;
    const genLabel = `[GEN_${padGen(gen)}]`;

    switch (row.type) {
      case "arena.created": {
        const state = row.data.state as { size?: number } | undefined;
        const agents = row.data.agents as BackendGenome[] | undefined;
        const size = state?.size ?? agents?.length ?? "—";
        lines.push({
          id: row.id,
          kind: "ARENA_READY",
          genLabel: `[GEN_00]`,
          body: `ARENA_READY :: ${row.arenaId}  SIZE ${size}`,
        });
        break;
      }
      case "arena.round.started": {
        const data = row.data as { genomeIds?: string[]; round?: number };
        const n = data.genomeIds?.length ?? 0;
        const r = typeof data.round === "number" ? data.round : row.round;
        lines.push({
          id: row.id,
          kind: "ROUND_START",
          genLabel,
          body: `ROUND_START :: R${r}  AGENTS ${n}`,
        });
        break;
      }
      case "arena.round.completed": {
        const data = row.data as { result?: { ranked?: Array<{ genomeId?: string; fitness?: number }>; generation?: number } };
        const ranked = data.result?.ranked ?? [];
        const genFromResult = data.result?.generation ?? gen;
        const gl = `[GEN_${padGen(genFromResult)}]`;
        const cap = arenaSize && arenaSize > 0 ? arenaSize : ranked.length;
        lines.push({
          id: `${row.id}-end`,
          kind: "ROUND_END",
          genLabel: gl,
          body: `ROUND_END  :: AGENTS_ALIVE ${ranked.length}/${cap}`,
        });
        const sorted = [...ranked].sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
        for (const entry of sorted.slice(0, 2)) {
          const raw = entry as { genomeId?: string; genome_id?: string };
          const id = raw.genomeId ?? raw.genome_id ?? "";
          if (!id) continue;
          lines.push({
            id: `${row.id}-survivor-${id}`,
            kind: "SURVIVOR",
            genLabel: gl,
            body: `SURVIVOR   :: ${shortGenomeLabel(id)}  (FITNESS: ${(entry.fitness ?? 0).toFixed(2)})`,
          });
        }
        break;
      }
      case "arena.genome.burned": {
        const genome = row.data.genome as BackendGenome | undefined;
        if (genome) {
          lines.push({
            id: row.id,
            kind: "ELIMINATED",
            genLabel,
            body: `ELIMINATED :: ${shortGenomeLabel(genome.genome_id)}  (FITNESS: ${Number(genome.fitness ?? 0).toFixed(2)})`,
          });
        }
        break;
      }
      case "arena.child.created": {
        const data = row.data as {
          child?: BackendGenome;
          parents?: { best: BackendGenome; second: BackendGenome };
          generation?: number;
        };
        const child = data.child;
        const parents = data.parents;
        const cg = typeof data.generation === "number" ? data.generation : child?.generation ?? gen;
        const gl = `[GEN_${padGen(cg)}]`;
        if (child && parents) {
          const a = shortGenomeLabel(parents.best.genome_id);
          const b = shortGenomeLabel(parents.second.genome_id);
          lines.push({
            id: `${row.id}-child`,
            kind: "CHILD",
            genLabel: gl,
            body: `CHILD      :: ${shortGenomeLabel(child.genome_id)}  ← ${a} × ${b}`,
          });
          lines.push(...weightMutationLines(child, parents));
        } else if (child && child.parent_ids.length >= 2) {
          const a = shortGenomeLabel(child.parent_ids[0]!);
          const b = shortGenomeLabel(child.parent_ids[1]!);
          lines.push({
            id: `${row.id}-child`,
            kind: "CHILD",
            genLabel: gl,
            body: `CHILD      :: ${shortGenomeLabel(child.genome_id)}  ← ${a} × ${b}`,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return lines;
}

function lineClass(kind: ActivityLineKind): string {
  switch (kind) {
    case "SURVIVOR":
      return "activity-log-line activity-log-line--survivor";
    case "ELIMINATED":
      return "activity-log-line activity-log-line--eliminated";
    case "CHILD":
      return "activity-log-line activity-log-line--child";
    case "MUTATION":
      return "activity-log-line activity-log-line--mutation";
    case "ROUND_END":
    case "ROUND_START":
    case "ARENA_READY":
      return "activity-log-line activity-log-line--neutral";
    case "ERROR":
      return "activity-log-line activity-log-line--error";
    default:
      return "activity-log-line";
  }
}

type ActivityLogPanelProps = {
  timelineRows: TimelineRow[];
  error: string | null;
  runBusy: boolean;
  arenaSize: number | null;
};

export function ActivityLogPanel({ timelineRows, error, runBusy, arenaSize }: ActivityLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);
  const lines = rowsToActivityLines(timelineRows, error, arenaSize);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 48;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    stickBottomRef.current = nearBottom;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, lines]);

  const empty = lines.length === 0 && !error;

  return (
    <section className="panel activity-log-panel" aria-label="Activity log">
      <div className="activity-log-header">
        <span className="panel-title activity-log-header-title">
          ACTIVITY_LOG&nbsp;&nbsp;::&nbsp;&nbsp;LIVE_FEED
        </span>
        <span className={`activity-log-live-dot${runBusy ? " activity-log-live-dot--on" : ""}`} aria-hidden>
          ●
        </span>
      </div>
      <div ref={scrollRef} className="activity-log-scroll" onScroll={onScroll}>
        {empty ? (
          <div className="activity-log-empty">NO_ACTIVITY&nbsp;&nbsp;::&nbsp;&nbsp;RUN_ARENA_TO_BEGIN</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={lineClass(line.kind)}>
              <span className="activity-log-meta">{line.genLabel}</span>
              <span className="activity-log-text">{line.body}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
