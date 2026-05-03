import { useMemo } from "react";
import { useArenaStore } from "../state/arenaStore";

const SERVICES = [
  "0G_CHAIN",
  "0G_STORAGE",
  "0G_COMPUTE",
  "AXL_NODE",
  "KEEPERHUB_MCP",
  "UNISWAP_API",
] as const;

function statusRow(label: string, online: boolean, latency: number | null, lastPing: string) {
  return (
    <tr key={label}>
      <td>{label}</td>
      <td>
        <span className={`status-pill ${online ? "status-pill-evolved" : "status-pill-dead"}`}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </td>
      <td className="numeric">{latency === null ? "-- ms" : `${latency} ms`}</td>
      <td>{lastPing}</td>
    </tr>
  );
}

export function SettingsPage() {
  const { backendHealthy, backendLatencyMs, arenaId, backendHealthy: connected } = useArenaStore();
  const lastPing = useMemo(() => new Date().toISOString(), [backendHealthy, backendLatencyMs]);
  const online = connected === true;

  return (
    <main className="page-shell settings-page">
      <section className="settings-summary-grid">
        <article className="panel stat-card">
          <div className="panel-title">SYSTEM_STATUS</div>
          <div className="genome-hero-value accent">{backendHealthy === true ? "ONLINE" : "OFFLINE"}</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">TOURNAMENT_MODE</div>
          <div className="genome-hero-value">BACKEND_CONNECTED</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">LATENCY</div>
          <div className="genome-hero-value mono-break">{backendLatencyMs === null ? "-- ms" : `${backendLatencyMs} ms`}</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">ARENA_ID</div>
          <div className="genome-hero-value mono-break">{arenaId}</div>
        </article>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div className="panel-title">SYSTEM_STATUS</div>
          <div className="section-subtitle">CONNECTIVITY_AND_LATENCY</div>
        </div>
        <table className="table settings-table">
          <thead>
            <tr>
              <th>SERVICE</th>
              <th>STATUS</th>
              <th className="numeric">LATENCY</th>
              <th>LAST_PING</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((service) => statusRow(service, online, backendLatencyMs, lastPing))}
          </tbody>
        </table>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div className="panel-title">TOURNAMENT_CONFIG</div>
          <div className="section-subtitle">READ_ONLY_CONSTANTS</div>
        </div>
        <div className="settings-config-grid">
          <div className="settings-config-row"><span>POPULATION_SIZE</span><span>5</span></div>
          <div className="settings-config-row"><span>ROUNDS_PER_GENERATION</span><span>5</span></div>
          <div className="settings-config-row"><span>SURVIVORS_PER_GENERATION</span><span>2</span></div>
          <div className="settings-config-row"><span>DEATHS_PER_GENERATION</span><span>1</span></div>
          <div className="settings-config-row"><span>MUTATION_RATE_INITIAL</span><span>0.30</span></div>
          <div className="settings-config-row"><span>INFERENCE_MODEL</span><span>qwen3-6-plus</span></div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div className="panel-title">ENVIRONMENT_VARIABLES</div>
          <div className="section-subtitle">BACKEND_ENV_SURFACE_NOT_EXPOSED</div>
        </div>
        <div className="settings-config-grid">
          <div className="settings-config-row"><span>ZERO_G_RPC_URL</span><span>FROM_BACKEND_ENV</span></div>
          <div className="settings-config-row"><span>ZERO_G_COMPUTE_ENDPOINT</span><span>FROM_BACKEND_ENV</span></div>
          <div className="settings-config-row"><span>ZERO_G_API_KEY</span><span>FROM_BACKEND_ENV</span></div>
          <div className="settings-config-row"><span>AXL_RPC_URL</span><span>FROM_BACKEND_ENV</span></div>
          <div className="settings-config-row"><span>KEEPERHUB_ENDPOINT</span><span>FROM_BACKEND_ENV</span></div>
          <div className="settings-config-row"><span>UNISWAP_ROUTER_ADDRESS</span><span>FROM_BACKEND_ENV</span></div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div className="panel-title">ABOUT</div>
          <div className="section-subtitle">PROJECT_METADATA</div>
        </div>
        <div className="settings-about-grid">
          <div className="settings-about-row"><span>DARWIN_PROTOCOL_VERSION</span><span>0.1.0</span></div>
          <div className="settings-about-row"><span>BUILD_HASH</span><span>frontend-live-backend</span></div>
          <div className="settings-about-row"><span>REPO_LINK</span><span>github.com/Apurvborhade/Cambrian</span></div>
        </div>
      </section>
    </main>
  );
}
