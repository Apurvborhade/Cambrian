import type { TournamentState } from "../data/domain";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function StatusBar({
  tournament,
  backendHealthy,
  backendLatencyMs,
  latestBlock,
  currentGenomeId,
}: {
  tournament: TournamentState;
  backendHealthy: boolean | null;
  backendLatencyMs: number | null;
  latestBlock: number | null;
  currentGenomeId: string | null;
}) {
  const aliveCount = tournament.agents.filter((agent) => agent.status !== "DEAD").length;
  return (
    <footer className="status-bar">
      <span>SYS_HEALTH | {backendHealthy === true ? "ONLINE" : backendHealthy === false ? "OFFLINE" : "CHECKING"}</span>
      <span>LATENCY | {backendLatencyMs === null ? "-- ms" : `${backendLatencyMs} ms`}</span>
      <span>BLOCK | {latestBlock === null ? "--" : latestBlock}</span>
      <span>CURRENT_GEN | GEN_{pad(tournament.current_generation)}</span>
      <span>AGENTS_ALIVE | {aliveCount} / {tournament.population_size}</span>
      <span>ACTIVE | {currentGenomeId ?? "--"}</span>
      <span>TIME_UTC | {new Date().toISOString().slice(11, 19)}</span>
    </footer>
  );
}
