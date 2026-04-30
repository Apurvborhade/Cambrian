const SERVICES = [
  "0G_CHAIN",
  "0G_STORAGE",
  "0G_COMPUTE",
  "AXL_NODE",
  "KEEPERHUB_MCP",
  "UNISWAP_API",
];

const ENV_KEYS = [
  "ZERO_G_RPC_URL",
  "ZERO_G_COMPUTE_ENDPOINT",
  "ZERO_G_API_KEY",
  "ZERO_G_STORAGE_ENDPOINT",
  "ZERO_G_STORAGE_API_KEY",
  "AXL_RPC_URL",
  "AXL_API_KEY",
  "KEEPERHUB_ENDPOINT",
  "KEEPERHUB_API_KEY",
  "UNISWAP_SUBGRAPH_URL",
  "UNISWAP_ROUTER_ADDRESS",
  "UNISWAP_FACTORY_ADDRESS",
  "DATABASE_URL",
  "REDIS_URL",
  "MCP_SERVER_URL",
  "KEEPER_PRIVATE_KEY",
  "SYSTEM_BUILD_HASH",
];

function statusRow(label: string) {
  return (
    <tr key={label}>
      <td>{label}</td>
      <td>
        <span className="status-dot status-dot-offline" />
        OFFLINE
      </td>
      <td className="numeric">-- ms</td>
      <td>--</td>
    </tr>
  );
}

export function SettingsPage() {
  return (
    <main className="page-shell settings-page">
      <section className="settings-summary-grid">
        <article className="panel stat-card">
          <div className="panel-title">SYSTEM_STATUS</div>
          <div className="genome-hero-value accent">OFFLINE</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">TOURNAMENT_MODE</div>
          <div className="genome-hero-value">READ_ONLY</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">BUILD_HASH</div>
          <div className="genome-hero-value mono-break">frontend-1a2b3c4</div>
        </article>
        <article className="panel stat-card">
          <div className="panel-title">REPO_LINK</div>
          <div className="genome-hero-value mono-break">github.com/Apurvborhade/Cambrian</div>
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
          <tbody>{SERVICES.map(statusRow)}</tbody>
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
          <div className="section-subtitle">NOT_SET_IN_FRONTEND_ONLY_MODE</div>
        </div>
        <div className="env-grid">
          {ENV_KEYS.map((key) => (
            <div key={key} className="env-row">
              <span className="env-key">{key}</span>
              <span className="status-pill status-pill-dead">[NOT_SET]</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div className="panel-title">ABOUT</div>
          <div className="section-subtitle">PROJECT_METADATA</div>
        </div>
        <div className="settings-about-grid">
          <div className="settings-about-row"><span>DARWIN_PROTOCOL_VERSION</span><span>0.1.0</span></div>
          <div className="settings-about-row"><span>BUILD_HASH</span><span>frontend-1a2b3c4</span></div>
          <div className="settings-about-row"><span>REPO_LINK</span><span>github.com/Apurvborhade/Cambrian</span></div>
        </div>
      </section>
    </main>
  );
}
