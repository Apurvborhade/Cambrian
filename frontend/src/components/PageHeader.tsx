import type { TournamentState } from "../data/mockData";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function routeLabel(route: string) {
  if (route === "/") return "SWARM";
  return route.replace("/", "").toUpperCase() || "SWARM";
}

export function PageHeader({
  route,
  tournament,
}: {
  route: string;
  tournament: TournamentState;
}) {
  const utcNow = new Date().toISOString().slice(11, 19);
  return (
    <header className="page-header">
      <div className="breadcrumb">
        <span className="breadcrumb-root">DARWIN_PROTOCOL</span>
        <span className="breadcrumb-sep">::</span>
        <span>{routeLabel(route)}</span>
      </div>
      <div className="header-ticker">
        <span>GEN_{pad(tournament.current_generation)}</span>
        <span>ROUND_{pad(tournament.current_round)}</span>
        <span>TIME_UTC {utcNow}</span>
      </div>
    </header>
  );
}
