import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useArenaStore } from "../state/arenaStore";
import { StatusPill } from "../components/StatusPill";
import type { Genome } from "../data/mockData";

type GeneRow = {
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
};

const GENERATIONS = [0, 1, 2] as const;

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function geneRows(parentA: Genome, parentB: Genome, child: Genome): GeneRow[] {
  const parentAverage = {
    price_momentum: average([parentA.tool_weights.price_momentum, parentB.tool_weights.price_momentum]),
    volume_signal: average([parentA.tool_weights.volume_signal, parentB.tool_weights.volume_signal]),
    liquidity_depth: average([parentA.tool_weights.liquidity_depth, parentB.tool_weights.liquidity_depth]),
    volatility_index: average([parentA.tool_weights.volatility_index, parentB.tool_weights.volatility_index]),
    block_timing: average([parentA.tool_weights.block_timing, parentB.tool_weights.block_timing]),
    risk_threshold: average([parentA.risk_threshold, parentB.risk_threshold]),
    memory_window: average([parentA.memory_window, parentB.memory_window]),
  };

  return [
    { label: "PRICE_MOMENTUM", oldValue: parentAverage.price_momentum, newValue: child.tool_weights.price_momentum, delta: child.tool_weights.price_momentum - parentAverage.price_momentum },
    { label: "VOLUME_SIGNAL", oldValue: parentAverage.volume_signal, newValue: child.tool_weights.volume_signal, delta: child.tool_weights.volume_signal - parentAverage.volume_signal },
    { label: "LIQUIDITY_DEPTH", oldValue: parentAverage.liquidity_depth, newValue: child.tool_weights.liquidity_depth, delta: child.tool_weights.liquidity_depth - parentAverage.liquidity_depth },
    { label: "VOLATILITY_INDEX", oldValue: parentAverage.volatility_index, newValue: child.tool_weights.volatility_index, delta: child.tool_weights.volatility_index - parentAverage.volatility_index },
    { label: "BLOCK_TIMING", oldValue: parentAverage.block_timing, newValue: child.tool_weights.block_timing, delta: child.tool_weights.block_timing - parentAverage.block_timing },
    { label: "RISK_THRESHOLD", oldValue: parentAverage.risk_threshold, newValue: child.risk_threshold, delta: child.risk_threshold - parentAverage.risk_threshold },
    { label: "MEMORY_WINDOW", oldValue: parentAverage.memory_window, newValue: child.memory_window, delta: child.memory_window - parentAverage.memory_window },
  ];
}

function deltaClass(delta: number) {
  if (Math.abs(delta) < 0.01) return "delta-neutral";
  return delta > 0 ? "delta-positive" : "delta-negative";
}

export function GenerationPage() {
  const { allGenomes, tournament } = useArenaStore();
  const [selectedGeneration, setSelectedGeneration] = useState<(typeof GENERATIONS)[number]>(0);

  const generationAgents = useMemo(
    () => allGenomes.filter((agent) => agent.generation === selectedGeneration),
    [allGenomes, selectedGeneration],
  );

  const averageFitness = average(generationAgents.map((agent) => agent.fitness_score));
  const child = allGenomes.find((agent) => agent.generation > 0) ?? null;
  const parents = child?.parent_ids
    .map((parentId) => allGenomes.find((agent) => agent.genome_id === parentId))
    .filter((agent): agent is Genome => Boolean(agent)) ?? [];
  const parentA = parents[0];
  const parentB = parents[1];

  return (
    <main className="page-shell generation-page">
      <section className="panel generation-tabs-panel">
        <div className="section-heading">
          <div className="panel-title">GENERATION_VIEW</div>
          <div className="section-subtitle">SIDE_BY_SIDE_EVOLUTION_COMPARISON</div>
        </div>
        <div className="generation-tabs">
          {GENERATIONS.map((generation) => (
            <button
              key={generation}
              type="button"
              className={`generation-tab${selectedGeneration === generation ? " generation-tab-active" : ""}`}
              onClick={() => setSelectedGeneration(generation)}
            >
              [GEN_{String(generation).padStart(2, "0")}]
            </button>
          ))}
        </div>
      </section>

      <section className="generation-summary-grid">
        <article className="panel generation-summary-card">
          <div className="panel-title">START_POPULATION</div>
          <div className="generation-summary-value">{generationAgents.length}</div>
        </article>
        <article className="panel generation-summary-card">
          <div className="panel-title">END_POPULATION</div>
          <div className="generation-summary-value">{generationAgents.filter((agent) => agent.status !== "DEAD").length}</div>
        </article>
        <article className="panel generation-summary-card">
          <div className="panel-title">AVERAGE_FITNESS</div>
          <div className="generation-summary-value accent">{averageFitness.toFixed(2)}</div>
        </article>
        <article className="panel generation-summary-card">
          <div className="panel-title">SURVIVORS</div>
          <div className="generation-summary-value">{tournament.survivors}</div>
        </article>
      </section>

      <section className="panel generation-content-panel">
        <div className="section-heading">
          <div className="panel-title">GENERATION_{String(selectedGeneration).padStart(2, "0")}_CARDS</div>
          <div className="section-subtitle">COMPACT_AGENT_SNAPSHOTS</div>
        </div>
        <div className="generation-card-grid">
          {generationAgents.map((agent) => (
            <article key={agent.genome_id} className="generation-agent-card">
              <div className="generation-agent-card-top">
                <div>
                  <div className="generation-agent-name">{shortName(agent.genome_id)}</div>
                  <div className="generation-agent-sub">GENOME_REF :: {agent.storage_key}</div>
                </div>
                <StatusPill status={agent.status} />
              </div>
              <div className="generation-agent-meta">
                FITNESS :: {agent.fitness_score.toFixed(1)} | RISK :: {Math.round(agent.risk_threshold * 100)}%
              </div>
              <div className="risk-bar generation-risk-bar">
                <div className="risk-bar-fill" style={{ width: `${Math.round(agent.risk_threshold * 100)}%` }} />
              </div>
              <Link className="chip chip-link generation-chip" to={`/genome?id=${agent.genome_id}`}>
                OPEN_GENOME
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="generation-split-grid">
        <article className="panel crossover-panel">
          <div className="section-heading">
            <div className="panel-title">CROSSOVER_EVENT</div>
            <div className="section-subtitle">PARENTS_X_CHILD</div>
          </div>
          {child && parentA && parentB ? (
            <div className="crossover-body">
              <div className="crossover-line">
                PARENTS ::{" "}
                <Link className="chip chip-link" to={`/genome?id=${parentA.genome_id}`}>
                  {shortName(parentA.genome_id)}
                </Link>
                <span className="crossover-symbol">x</span>
                <Link className="chip chip-link" to={`/genome?id=${parentB.genome_id}`}>
                  {shortName(parentB.genome_id)}
                </Link>
                <span className="crossover-symbol">{'->'}</span>
                <Link className="chip chip-link" to={`/genome?id=${child.genome_id}`}>
                  {shortName(child.genome_id)}
                </Link>
              </div>
              <div className="crossover-line">CHILD_GENOME :: {child.genome_id}</div>
              <div className="crossover-line">
                MUTATION_RATE_AT_BIRTH :: {(child.mutation_rate_at_birth * 100).toFixed(1)}%
              </div>
            </div>
          ) : (
            <div className="crossover-empty">NO_CROSSOVER_EVENT_AVAILABLE</div>
          )}
        </article>

        <article className="panel gene-delta-panel">
          <div className="section-heading">
            <div className="panel-title">GENE_DELTA</div>
            <div className="section-subtitle">PARENT_AVERAGE_VS_CHILD</div>
          </div>
          {child && parentA && parentB ? (
            <div className="gene-delta-table">
              {geneRows(parentA, parentB, child).map((row) => (
                <div key={row.label} className="gene-delta-row">
                  <span className="gene-delta-label">{row.label}</span>
                  <span className={`gene-delta-value ${deltaClass(row.delta)}`}>
                    {typeof row.oldValue === "number" ? row.oldValue.toFixed(2) : row.oldValue}
                    <span className="delta-sep">{' -> '}</span>
                    {typeof row.newValue === "number" ? row.newValue.toFixed(2) : row.newValue}
                    <span className="delta-sep"> :: </span>
                    {row.delta > 0 ? "+" : ""}
                    {row.delta.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="crossover-empty">NO_MUTATION_DELTA_AVAILABLE</div>
          )}
        </article>
      </section>
    </main>
  );
}
