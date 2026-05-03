import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { PageHeader } from "./components/PageHeader";
import { StatusBar } from "./components/StatusBar";
import { useArenaStore } from "./state/arenaStore";
import { LandingPage } from "./pages/Landing";
import { LineagePage } from "./pages/Lineage";
import { GenomeLabPage } from "./pages/GenomeLab";
import { LedgerPage } from "./pages/Ledger";
import { GenerationPage } from "./pages/Generation";
import { ExecLogPage } from "./pages/ExecLog";
import { SettingsPage } from "./pages/Settings";
import { SwarmPage } from "./pages/Swarm";
import { TournamentPage } from "./pages/Tournament";

function AppShell() {
  const location = useLocation();
  const { tournament, backendHealthy, backendLatencyMs, timelineRows, currentGenome } = useArenaStore();
  const isLanding = location.pathname === "/";
  return (
    <div className={`app-shell${isLanding ? " app-shell-landing" : ""}`}>
      {!isLanding ? <Sidebar /> : null}
      <div className="app-main">
        <PageHeader
          route={location.pathname}
          tournament={tournament}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/swarm" element={<SwarmPage />} />
          <Route path="/lineage" element={<LineagePage />} />
          <Route path="/genome" element={<GenomeLabPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/generation" element={<GenerationPage />} />
          <Route path="/logs" element={<ExecLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isLanding ? (
        <StatusBar
          tournament={tournament}
          backendHealthy={backendHealthy}
          backendLatencyMs={backendLatencyMs}
          latestBlock={timelineRows.at(-1)?.block_number ?? null}
          currentGenomeId={currentGenome?.genome_id ?? null}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
