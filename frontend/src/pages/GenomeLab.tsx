import type React from "react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { StatusPill } from "../components/StatusPill";
import { useArenaStore } from "../state/arenaStore";
import type { Genome } from "../data/domain";

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function formatGenomeRef(genomeId: string) {
  const suffix = genomeId.split("_").at(-1)?.toUpperCase() ?? genomeId.toUpperCase();
  return `#241-${suffix}`;
}

function truncate(value: string, size = 8) {
  return value.length <= size * 2 ? value : `${value.slice(0, size)}...${value.slice(-size)}`;
}

function copyable(value: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).catch(() => undefined);
  }
}

function fieldRow(label: string, value: string | number | React.ReactNode) {
  return (
    <div className="genome-field-row">
      <span className="genome-field-label">{label}</span>
      <span className="genome-field-value">{value}</span>
    </div>
  );
}

export function GenomeLabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allGenomes } = useArenaStore();

  const selectedGenomeId = searchParams.get("id");
  const genome = useMemo<Genome | null>(() => {
    return allGenomes.find((agent) => agent.genome_id === selectedGenomeId) ?? allGenomes[0] ?? null;
  }, [allGenomes, selectedGenomeId]);

  const showPicker = !selectedGenomeId || !allGenomes.some((agent) => agent.genome_id === selectedGenomeId);

  const radarData = genome
    ? [
        { axis: "PRICE_MOMENTUM", value: genome.tool_weights.price_momentum },
        { axis: "VOLUME_SIGNAL", value: genome.tool_weights.volume_signal },
        { axis: "LIQUIDITY_DEPTH", value: genome.tool_weights.liquidity_depth },
        { axis: "VOLATILITY_INDEX", value: genome.tool_weights.volatility_index },
        { axis: "BLOCK_TIMING", value: genome.tool_weights.block_timing },
      ]
    : [];

  const fitnessHistory = genome?.fitness_history.map((value, index) => ({
    round: `R${String(index + 1).padStart(2, "0")}`,
    value,
  })) ?? [];

  const roundsActive = genome ? genome.fitness_history.filter((value) => value !== 0).length : 0;
  const totalRounds = genome?.fitness_history.length ?? 0;
  const riskPercent = genome ? Math.round(genome.risk_threshold * 100) : 0;

  if (!genome) {
    return (
      <main className="page-shell genome-page">
        <section className="panel genome-picker-panel">
          <div className="section-heading">
            <div className="panel-title">GENOME_SELECTOR</div>
            <div className="section-subtitle">NO_GENOMES_AVAILABLE</div>
          </div>
          <div className="empty-state">
            <div className="empty-state-title">NO_DATA_FROM_BACKEND</div>
            <div className="empty-state-copy">CREATE_OR_RUN_AN_ARENA_TO_POPULATE_GENOMES</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell genome-page">
      <section className="stat-grid genome-hero-grid">
        <article className="panel stat-card">
          <div className="panel-title">GENOME_ID</div>
          <div className="genome-hero-value mono-break">{genome.genome_id}</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">GENERATION</div>
          <div className="genome-hero-value">GEN_{String(genome.generation).padStart(2, "0")}</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">FITNESS_SCORE</div>
          <div className="genome-hero-value accent">{genome.fitness_score.toFixed(1)}</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">ROUNDS_ACTIVE</div>
          <div className="genome-hero-value">
            {roundsActive} / {totalRounds}
          </div>
        </article>
      </section>

      {showPicker ? (
        <section className="panel genome-picker-panel">
          <div className="section-heading">
            <div className="panel-title">GENOME_SELECTOR</div>
            <div className="section-subtitle">SELECT_A_SPECIMEN_TO_INSPECT</div>
          </div>
          <div className="genome-picker-grid">
            {allGenomes.map((agent) => (
              <button
                key={agent.genome_id}
                className={`genome-picker-card${agent.genome_id === genome.genome_id ? " genome-picker-card-active" : ""}`}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("id", agent.genome_id);
                  setSearchParams(next);
                }}
              >
                <div className="genome-picker-card-top">
                  <span className="genome-picker-name">{shortName(agent.genome_id)}</span>
                  <StatusPill status={agent.status} />
                </div>
                <div className="genome-picker-sub">{formatGenomeRef(agent.genome_id)}</div>
                <div className="genome-picker-meta">
                  FITNESS :: {agent.fitness_score.toFixed(1)} | GEN_{String(agent.generation).padStart(2, "0")}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="layout-two-column genome-layout">
        <article className="panel genome-left-column">
          <div className="genome-identity-block">
            <div className="section-heading compact">
              <div className="panel-title">IDENTITY</div>
              <div className="section-subtitle">READ_ONLY_GENOME_PROFILE</div>
            </div>

            {fieldRow(
              "GENOME_ID",
              <span className="copy-row">
                <span className="mono-break">{genome.genome_id}</span>
                <button className="button copy-button" type="button" onClick={() => copyable(genome.genome_id)}>
                  COPY
                </button>
              </span>,
            )}
            {fieldRow("GENERATION", <span className="status-pill status-pill-evolved">GEN_{String(genome.generation).padStart(2, "0")}</span>)}
            {fieldRow(
              "PARENT_IDS",
              genome.parent_ids.length ? (
                <div className="chip-row">
                  {genome.parent_ids.map((parentId) => (
                    <Link key={parentId} className="chip chip-link" to={`/genome?id=${parentId}`}>
                      {shortName(parentId)}
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="chip chip-muted">GENESIS - NO_PARENTS</span>
              ),
            )}
            {fieldRow("MUTATION_SEED", <span className="mono-break">{genome.mutation_seed}</span>)}
            {fieldRow("MUTATION_RATE_AT_BIRTH", <span>{(genome.mutation_rate_at_birth * 100).toFixed(1)}%</span>)}
            {fieldRow("CREATED_AT_BLOCK", genome.created_at_block)}
            {fieldRow(
              "NFT_ADDRESS",
              <span className="copy-row">
                <span>{truncate(genome.nft_address)}</span>
                <button className="button copy-button" type="button" onClick={() => copyable(genome.nft_address)}>
                  COPY
                </button>
              </span>,
            )}
            {fieldRow("STATUS", <StatusPill status={genome.status} />)}
            {fieldRow(
              "RISK_THRESHOLD",
              <div className="risk-bar">
                <div className="risk-bar-fill" style={{ width: `${riskPercent}%` }} />
              </div>,
            )}
            {fieldRow("MEMORY_WINDOW", <span>{genome.memory_window} ROUNDS</span>)}
          </div>

          <div className="detail-section genome-reasoning-panel">
            <div className="panel-title">REASONING_STRATEGY</div>
            <div className="genome-reasoning-text">"{genome.reasoning_strategy}"</div>
          </div>
        </article>

        <article className="panel genome-right-column">
          <div className="section-heading">
            <div className="panel-title">TOOL_WEIGHT_RADAR</div>
            <div className="section-subtitle">GENE_FREQUENCY_PROFILE</div>
          </div>
          <div className="radar-shell">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#666666", fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
                <Radar dataKey="value" stroke="#00ffcc" fill="rgba(0,255,204,0.15)" fillOpacity={1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="detail-section">
            <div className="panel-title">RAW_WEIGHTS</div>
            <table className="table genome-weight-table">
              <thead>
                <tr>
                  <th>AXIS</th>
                  <th className="numeric">VALUE</th>
                </tr>
              </thead>
              <tbody>
                {radarData.map((row) => (
                  <tr key={row.axis}>
                    <td>{row.axis}</td>
                    <td className="numeric">{row.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel genome-fitness-panel">
        <div className="section-heading">
          <div className="panel-title">FITNESS_PANEL</div>
          <div className="section-subtitle">HISTORY_DRIVEN_BY_FITNESS_HISTORY</div>
        </div>
        <div className="genome-fitness-summary">
          <div className="metric-card">
            <div className="panel-title">FITNESS_SCORE</div>
            <div className="metric-value accent">{genome.fitness_score.toFixed(1)}</div>
          </div>
          <div className="metric-card">
            <div className="panel-title">ROUNDS_ACTIVE</div>
            <div className="metric-value">
              {roundsActive} / {totalRounds}
            </div>
          </div>
        </div>
        <div className="fitness-bars-shell">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fitnessHistory} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <XAxis dataKey="round" tick={{ fill: "#666666", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666666", fontSize: 11 }} />
              <Bar dataKey="value" fill="#00ffcc" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
