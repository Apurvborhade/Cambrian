import { Link, useNavigate } from "react-router-dom";
import type { Genome } from "../data/mockData";
import { FitnessSparkline } from "./FitnessSparkline";
import { StatusPill } from "./StatusPill";

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  if (right) {
    return `${left}-${right}`;
  }
  if (tail.length <= 2) {
    return tail;
  }
  return `${tail.slice(0, -2)}-${tail.slice(-2)}`;
}

function formatGenomeRef(genomeId: string) {
  const suffix = genomeId.split("_").at(-1)?.toUpperCase() ?? genomeId.toUpperCase();
  return `#241-${suffix}`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toolWeightRows(genome: Genome) {
  return [
    ["PRICE_MOMENTUM", genome.tool_weights.price_momentum],
    ["VOLUME_SIGNAL", genome.tool_weights.volume_signal],
    ["LIQUIDITY_DEPTH", genome.tool_weights.liquidity_depth],
    ["VOLATILITY_INDEX", genome.tool_weights.volatility_index],
    ["BLOCK_TIMING", genome.tool_weights.block_timing],
  ] as const;
}

export function AgentDetailPanel({
  genome,
  readOnly = false,
}: {
  genome: Genome;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();

  const parentAverage = genome.parent_ids.length ? 0.5 : 0.5;
  const deltas = toolWeightRows(genome).slice(0, 3).map(([label, value], index) => {
    const baseline = genome.parent_ids.length
      ? [0.65, 0.6, 0.45][index]
      : parentAverage;
    return {
      label,
      value,
      delta: value - baseline,
    };
  });

  return (
    <aside className="panel agent-detail-panel">
      <div className="agent-detail-header">
        <div>
          <div className="panel-title">AGENT_PROFILE</div>
          <div className="agent-title">{shortName(genome.genome_id)}</div>
          <div className="agent-subtitle">GENOME_REF :: {formatGenomeRef(genome.genome_id)}</div>
        </div>
        <StatusPill status={genome.status} />
      </div>

      <div className="agent-metrics-grid">
        <div className="metric-card">
          <div className="panel-title">FITNESS</div>
          <div className="metric-value">{genome.fitness_score.toFixed(1)}</div>
        </div>
        <div className="metric-card">
          <div className="panel-title">STABILITY</div>
          <div className="metric-value">84.2%</div>
        </div>
      </div>

      <div className="detail-section">
        <div className="panel-title">ORIGIN_TRACING</div>
        <div className="chip-row">
          {genome.parent_ids.length ? (
            genome.parent_ids.map((parentId) => (
              <Link key={parentId} className="chip chip-link" to={`/genome?id=${parentId}`}>
                {shortName(parentId)}
              </Link>
            ))
          ) : (
            <span className="chip chip-muted">GENESIS — NO PARENTS</span>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="panel-title">MUTATION_ADAPTATIONS</div>
        <div className="delta-list">
          {deltas.map((delta) => {
            const sign = delta.delta > 0 ? "+" : "";
            const deltaClass =
              delta.delta > 0 ? "delta-positive" : delta.delta < 0 ? "delta-negative" : "delta-neutral";
            return (
              <div key={delta.label} className="delta-row">
                <span className="delta-label">{delta.label}</span>
                <span className={`delta-value ${deltaClass}`}>
                  {delta.value.toFixed(2)} <span className="delta-sep">::</span> {sign}
                  {delta.delta.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="detail-section">
        <div className="panel-title">FITNESS_TRAJECTORY</div>
        <FitnessSparkline values={genome.fitness_history} />
      </div>

      <button
        className="button button-primary agent-isolate-button"
        type="button"
        onClick={() => navigate(`/genome?id=${genome.genome_id}`)}
        disabled={readOnly}
      >
        ⬡ ISOLATE_SPECIMEN
      </button>
    </aside>
  );
}
