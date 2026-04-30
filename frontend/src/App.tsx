import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { PageHeader } from "./components/PageHeader";
import { StatusBar } from "./components/StatusBar";
import { mockTournamentState } from "./data/mockData";
import { LineagePage } from "./pages/Lineage";
import { GenomeLabPage } from "./pages/GenomeLab";
import { LedgerPage } from "./pages/Ledger";
import { GenerationPage } from "./pages/Generation";
import { ExecLogPage } from "./pages/ExecLog";
import { SwarmPage } from "./pages/Swarm";
import { TournamentPage } from "./pages/Tournament";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="page-shell">
      <div className="page-placeholder-card">
        <div className="page-placeholder-label">{title}</div>
        <div className="page-placeholder-value">COMING_SOON</div>
      </div>
    </main>
  );
}

function AppShell() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <PageHeader
          route={location.pathname}
          tournament={mockTournamentState}
        />
        <Routes>
          <Route path="/" element={<SwarmPage tournament={mockTournamentState} />} />
          <Route path="/lineage" element={<LineagePage />} />
          <Route path="/genome" element={<GenomeLabPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/generation" element={<GenerationPage />} />
          <Route path="/logs" element={<ExecLogPage />} />
          <Route path="/settings" element={<PlaceholderPage title="SYSTEM_OS" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <StatusBar tournament={mockTournamentState} />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
