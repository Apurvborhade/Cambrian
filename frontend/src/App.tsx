import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { PageHeader } from "./components/PageHeader";
import { StatusBar } from "./components/StatusBar";
import { mockTournamentState } from "./data/mockData";
import { SwarmPage } from "./pages/Swarm";

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
          <Route path="/lineage" element={<PlaceholderPage title="LINEAGE" />} />
          <Route path="/genome" element={<PlaceholderPage title="GENOME_LAB" />} />
          <Route path="/tournament" element={<PlaceholderPage title="TOURNAMENT" />} />
          <Route path="/ledger" element={<PlaceholderPage title="LEDGER" />} />
          <Route path="/generation" element={<PlaceholderPage title="GENERATION" />} />
          <Route path="/logs" element={<PlaceholderPage title="EXEC_LOG" />} />
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
