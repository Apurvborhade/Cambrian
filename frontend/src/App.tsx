import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { PageHeader } from "./components/PageHeader";
import { StatusBar } from "./components/StatusBar";
import { mockTournamentState } from "./data/mockData";
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
  const isLanding = location.pathname === "/";
  return (
    <div className={`app-shell${isLanding ? " app-shell-landing" : ""}`}>
      {!isLanding ? <Sidebar /> : null}
      <div className="app-main">
        <PageHeader
          route={location.pathname}
          tournament={mockTournamentState}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/swarm" element={<SwarmPage tournament={mockTournamentState} />} />
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
      {!isLanding ? <StatusBar tournament={mockTournamentState} /> : null}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
