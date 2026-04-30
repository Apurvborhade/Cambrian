import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { mockTournamentState, type Genome } from "../data/mockData";
import { StatusPill } from "../components/StatusPill";

type RoundCell = {
  agent: Genome;
  round: number;
  value: number | null;
  outcome: "POSITIVE" | "NEGATIVE" | "PENDING";
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
};

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function buildCells(agents: Genome[], currentRound: number, roundsPerGeneration: number) {
  return agents.flatMap((agent) =>
    Array.from({ length: roundsPerGeneration }, (_, index) => {
      const round = index + 1;
      const value = agent.fitness_history[index] ?? null;
      const outcome: RoundCell["outcome"] =
        round > currentRound || value === null
          ? "PENDING"
          : value >= 0.5
            ? "POSITIVE"
            : "NEGATIVE";
      const action: RoundCell["action"] = value === null ? "HOLD" : value >= 0.65 ? "BUY" : "SELL";
      const confidence = value === null ? 0 : Math.min(0.95, Math.max(0.12, value / 1.2));
      return { agent, round, value, outcome, action, confidence };
    }),
  );
}

function valueLabel(value: number | null) {
  if (value === null) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function TournamentPage() {
  const tournament = mockTournamentState;
  const [selectedCell, setSelectedCell] = useState<RoundCell | null>(null);

  const sortedAgents = useMemo(
    () => [...tournament.agents].sort((left, right) => right.fitness_score - left.fitness_score),
    [tournament.agents],
  );

  const roundCells = useMemo(
    () => buildCells(sortedAgents, tournament.current_round, tournament.rounds_per_generation),
    [sortedAgents, tournament.current_round, tournament.rounds_per_generation],
  );

  const progressPercent = (tournament.current_round / tournament.rounds_per_generation) * 100;

  const chartData = tournament.generation_fitness_avg.map((value, index) => ({
    generation: `GEN_${String(index).padStart(2, "0")}`,
    value,
  }));

  const roundsWon = new Map<string, number>();
  sortedAgents.forEach((agent) => {
    roundsWon.set(
      agent.genome_id,
      agent.fitness_history.slice(0, tournament.current_round).filter((value) => value >= 0.5).length,
    );
  });

  return (
    <main className="page-shell tournament-page">
      <section className="panel tournament-header-panel">
        <div className="tournament-header-row">
          <div>
            <div className="panel-title">TOURNAMENT</div>
            <div className="tournament-header-values">
              <span>GENERATION :: {String(tournament.current_generation).padStart(2, "0")}</span>
              <span>ROUND :: {String(tournament.current_round).padStart(2, "0")} / {String(tournament.rounds_per_generation).padStart(2, "0")}</span>
              <span>STATUS :: ACTIVE</span>
            </div>
          </div>
          <div className="tournament-progress-shell">
            <div className="tournament-progress-track">
              <div className="tournament-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="section-subtitle">ROUND_COMPLETION</div>
          </div>
        </div>
      </section>

      <section className="tournament-content-grid">
        <article className="panel tournament-grid-panel">
          <div className="section-heading">
            <div className="panel-title">ROUND_GRID</div>
            <div className="section-subtitle">5_AGENTS × 5_ROUNDS</div>
          </div>
          <div className="tournament-grid">
            <div className="tournament-grid-corner">AGENT / ROUND</div>
            {Array.from({ length: tournament.rounds_per_generation }, (_, index) => (
              <div key={`round-head-${index}`} className="tournament-grid-head">
                ROUND_{String(index + 1).padStart(2, "0")}
              </div>
            ))}
            {sortedAgents.map((agent) => (
              <FragmentRow
                key={agent.genome_id}
                agent={agent}
                cells={roundCells.filter((cell) => cell.agent.genome_id === agent.genome_id)}
                selectedCell={selectedCell}
                onSelect={setSelectedCell}
              />
            ))}
          </div>
        </article>

        <div className="tournament-right-column">
          <article className="panel tournament-tooltip-panel">
            <div className="section-heading">
              <div className="panel-title">ROUND_DETAIL</div>
              <div className="section-subtitle">CLICK_A_CELL_TO_INSPECT</div>
            </div>
            {selectedCell ? (
              <div className="tournament-tooltip-body">
                <div className="tournament-tooltip-title">
                  ROUND_{String(selectedCell.round).padStart(2, "0")} | {shortName(selectedCell.agent.genome_id)}
                </div>
                <div className="tournament-tooltip-line">
                  FITNESS: {valueLabel(selectedCell.value)} | ACTION: {selectedCell.action} | CONFIDENCE: {selectedCell.confidence.toFixed(2)}
                </div>
                <div className="tournament-tooltip-line">
                  OUTCOME: {selectedCell.outcome} | GENOME_REF :: {selectedCell.agent.storage_key}
                </div>
              </div>
            ) : (
              <div className="tournament-tooltip-empty">SELECT_A_CELL_TO_VIEW_ROUND_CONTEXT</div>
            )}
          </article>

          <article className="panel leaderboard-panel">
            <div className="section-heading">
              <div className="panel-title">LEADERBOARD</div>
              <div className="section-subtitle">SORTED_BY_FITNESS_TOTAL</div>
            </div>
            <table className="table leaderboard-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>AGENT</th>
                  <th>GENERATION</th>
                  <th className="numeric">FITNESS_TOTAL</th>
                  <th className="numeric">ROUNDS_WON</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent, index) => {
                  const topSurvivor = index < tournament.survivors;
                  const burnCandidate = index >= sortedAgents.length - 1;
                  return (
                    <tr
                      key={agent.genome_id}
                      className={`leaderboard-row${topSurvivor ? " leaderboard-row-survivor" : ""}${burnCandidate ? " leaderboard-row-burn" : ""}`}
                    >
                      <td>{index + 1}</td>
                      <td>{shortName(agent.genome_id)}</td>
                      <td>{String(agent.generation).padStart(2, "0")}</td>
                      <td className="numeric">{agent.fitness_score.toFixed(1)}</td>
                      <td className="numeric">{roundsWon.get(agent.genome_id) ?? 0}</td>
                      <td>
                        <StatusPill status={agent.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        </div>
      </section>

      <section className="panel tournament-chart-panel">
        <div className="section-heading">
          <div className="panel-title">POPULATION_FITNESS_EVOLUTION</div>
          <div className="section-subtitle">GENERATION_AVG_LINE_CHART</div>
        </div>
        <div className="tournament-chart-shell">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <XAxis dataKey="generation" tick={{ fill: "#666666", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666666", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#0d0d0d",
                  border: "1px solid #1a1a1a",
                  color: "#e8e8e8",
                  fontFamily: "JetBrains Mono, Courier New, monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#00ffcc" strokeWidth={2} dot={{ r: 3, fill: "#00ffcc" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function FragmentRow({
  agent,
  cells,
  selectedCell,
  onSelect,
}: {
  agent: Genome;
  cells: RoundCell[];
  selectedCell: RoundCell | null;
  onSelect: (cell: RoundCell) => void;
}) {
  return (
    <>
      <div className="tournament-grid-agent">
        <div className="tournament-grid-agent-name">{agent.genome_id}</div>
        <div className="tournament-grid-agent-meta">GEN_{String(agent.generation).padStart(2, "0")}</div>
      </div>
      {cells.map((cell) => {
        const isActive = selectedCell?.agent.genome_id === cell.agent.genome_id && selectedCell.round === cell.round;
        return (
          <button
            key={`${cell.agent.genome_id}-${cell.round}`}
            type="button"
            className={`tournament-cell tournament-cell-${cell.outcome.toLowerCase()}${isActive ? " tournament-cell-active" : ""}`}
            onClick={() => onSelect(cell)}
          >
            <span className="tournament-cell-value">{valueLabel(cell.value)}</span>
          </button>
        );
      })}
    </>
  );
}
