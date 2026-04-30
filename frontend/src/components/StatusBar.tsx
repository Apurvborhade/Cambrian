import type { TournamentState } from "../data/mockData";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function StatusBar({ tournament }: { tournament: TournamentState }) {
  const aliveCount = tournament.agents.filter((agent) => agent.status !== "DEAD").length;
  return (
    <footer className="status-bar">
      <span>SYS_HEALTH | OFFLINE</span>
      <span>BLOCK | --</span>
      <span>CURRENT_GEN | GEN_{pad(tournament.current_generation)}</span>
      <span>AGENTS_ALIVE | {aliveCount} / {tournament.population_size}</span>
      <span>TIME_UTC | {new Date().toISOString().slice(11, 19)}</span>
    </footer>
  );
}
