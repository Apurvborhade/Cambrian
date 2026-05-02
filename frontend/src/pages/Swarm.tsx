import { useEffect, useMemo } from "react";
import { AgentDetailPanel } from "../components/AgentDetailPanel";
import { StatusPill } from "../components/StatusPill";
import { useArenaStore } from "../state/arenaStore";
import type { Genome } from "../data/domain";

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [first = "", second = ""] = tail.split("_");
  if (second) return `${first}-${second}`;
  return tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function genomeRef(genome: Genome) {
  const suffix = genome.genome_id.split("_").at(-1)?.toUpperCase() ?? genome.genome_id.toUpperCase();
  return `#241-${suffix}`;
}

function computeMutationAdaptations(genome: Genome, allAgents: Genome[]) {
  const parents = genome.parent_ids
    .map((parentId) => allAgents.find((agent) => agent.genome_id === parentId))
    .filter((parent): parent is Genome => Boolean(parent));
  const parentBaseline = parents.length
    ? [
        parents.reduce((sum, parent) => sum + parent.tool_weights.price_momentum, 0) / parents.length,
        parents.reduce((sum, parent) => sum + parent.tool_weights.volume_signal, 0) / parents.length,
        parents.reduce((sum, parent) => sum + parent.tool_weights.liquidity_depth, 0) / parents.length,
        parents.reduce((sum, parent) => sum + parent.tool_weights.volatility_index, 0) / parents.length,
        parents.reduce((sum, parent) => sum + parent.tool_weights.block_timing, 0) / parents.length,
      ]
    : [0.5, 0.5, 0.5, 0.5, 0.5];
  return [
    ["PRICE_MOMENTUM", genome.tool_weights.price_momentum, parentBaseline[0]],
    ["VOLUME_SIGNAL", genome.tool_weights.volume_signal, parentBaseline[1]],
    ["LIQUIDITY_DEPTH", genome.tool_weights.liquidity_depth, parentBaseline[2]],
    ["VOLATILITY_INDEX", genome.tool_weights.volatility_index, parentBaseline[3]],
    ["BLOCK_TIMING", genome.tool_weights.block_timing, parentBaseline[4]],
  ] as const;
}

function statValue(value: string) {
  return <div className="stat-card-value">{value}</div>;
}

export function SwarmPage() {
  const { tournament, selectedGenomeId, setSelectedGenomeId } = useArenaStore();
  const selectedId = selectedGenomeId;

  const selectedAgent = useMemo(
    () =>
      tournament.agents.find((agent) => agent.genome_id === selectedId) ??
      tournament.agents[0] ??
      null,
    [selectedId, tournament.agents],
  );

  const aliveCount = tournament.agents.filter((agent) => agent.status !== "DEAD").length;
  const avgFitness = (
    tournament.agents.reduce((sum, agent) => sum + agent.fitness_score, 0) /
    Math.max(1, tournament.agents.length)
  ).toFixed(2);

  useEffect(() => {
    if (selectedAgent && selectedGenomeId !== selectedAgent.genome_id) {
      setSelectedGenomeId(selectedAgent.genome_id);
    }
  }, [selectedAgent, selectedGenomeId, setSelectedGenomeId]);

  return (
    <main className="page-shell">
      <section className="stat-grid">
        <article className="panel stat-card">
          <div className="panel-title">CURRENT_GENERATION</div>
          {statValue(`GEN_${String(tournament.current_generation).padStart(2, "0")}`)}
        </article>
        <article className="panel stat-card">
          <div className="panel-title">AGENTS_ALIVE</div>
          {statValue(`${aliveCount} / ${tournament.population_size}`)}
        </article>
        <article className="panel stat-card">
          <div className="panel-title">CURRENT_ROUND</div>
          {statValue(`ROUND_${String(tournament.current_round).padStart(2, "0")} / ${String(tournament.rounds_per_generation).padStart(2, "0")}`)}
        </article>
        <article className="panel stat-card">
          <div className="panel-title">AVG_FITNESS</div>
          {statValue(avgFitness)}
        </article>
      </section>

      <section className="layout-two-column swarm-layout">
        <article className="panel table-shell">
          <div className="section-heading">
            <div className="panel-title">AGENT_LIST</div>
            <div className="section-subtitle">SELECT_AGENT_TO_INSPECT</div>
          </div>
          <table className="table swarm-table">
            <thead>
              <tr>
                <th>AGENT_ID</th>
                <th>GENOME_REF</th>
                <th>STATUS</th>
                <th className="numeric">FITNESS</th>
                <th className="numeric">GENERATION</th>
                <th className="numeric">RISK_THRESH</th>
              </tr>
            </thead>
            <tbody>
              {tournament.agents.map((agent) => {
                const active = agent.genome_id === selectedId;
                return (
                  <tr
                    key={agent.genome_id}
                    className={`agent-row${active ? " agent-row-active" : ""}`}
                    onClick={() => {
                      setSelectedGenomeId(agent.genome_id);
                    }}
                  >
                    <td>
                      <div className="agent-cell-main">{shortName(agent.genome_id)}</div>
                      <div className="agent-cell-sub">{agent.genome_id}</div>
                    </td>
                    <td>{genomeRef(agent)}</td>
                    <td><StatusPill status={active ? "SELECTED" : agent.status} /></td>
                    <td className="numeric">{agent.fitness_score.toFixed(1)}</td>
                    <td className="numeric">{String(agent.generation).padStart(2, "0")}</td>
                    <td className="numeric">{Math.round(agent.risk_threshold * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        <div className="swarm-detail-column">
          {selectedAgent ? <AgentDetailPanel genome={selectedAgent} allAgents={tournament.agents} /> : null}

          <article className="panel detail-compact-panel">
            <div className="section-heading">
              <div className="panel-title">MUTATION_STATUS</div>
              <div className="section-subtitle">DELTA_FROM_PARENT_AVERAGE</div>
            </div>
            <div className="detail-compact-grid">
              {computeMutationAdaptations(selectedAgent, tournament.agents).map(([label, value, baseline]) => {
                const delta = value - baseline;
                const deltaClass =
                  delta > 0 ? "delta-positive" : delta < 0 ? "delta-negative" : "delta-neutral";
                const sign = delta > 0 ? "+" : "";
                return (
                  <div key={label} className="compact-mutation-row">
                    <span className="compact-mutation-label">{label}</span>
                    <span className={`compact-mutation-value ${deltaClass}`}>
                      {value.toFixed(2)} <span className="delta-sep">::</span> {sign}
                      {delta.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
