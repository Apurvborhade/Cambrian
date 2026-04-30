import { useEffect, useMemo, useRef, useState } from "react";
import { mockTournamentState, type Genome } from "../data/mockData";
import { StatusPill } from "../components/StatusPill";

type LogEntry = {
  block: number;
  round: number;
  kind: "ACTION_SUBMITTED" | "FITNESS_COMPUTED";
  lines: Array<[string, string]>;
};

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function buildLogs(agent: Genome): LogEntry[] {
  const entries: LogEntry[] = [];

  agent.fitness_history.forEach((fitness, index) => {
    const round = index + 1;
    const direction = round % 2 === 0 ? "SELL" : "BUY";
    const confidence = Math.min(0.99, Math.max(0.12, fitness / 1.2));
    const block = agent.created_at_block + round * 3 + index;

    entries.push({
      block,
      round,
      kind: "ACTION_SUBMITTED",
      lines: [
        ["direction", direction],
        ["confidence", confidence.toFixed(2)],
        ["agent", agent.genome_id],
        ["generation", String(agent.generation)],
        ["round", String(round).padStart(2, "0")],
      ],
    });

    entries.push({
      block: block + 1,
      round,
      kind: "FITNESS_COMPUTED",
      lines: [
        ["score", `${fitness >= 0 ? "+" : ""}${fitness.toFixed(1)}`],
        ["correct_direction", fitness >= 0.5 ? "true" : "false"],
        ["agent", agent.genome_id],
        ["generation", String(agent.generation)],
        ["round", String(round).padStart(2, "0")],
      ],
    });
  });

  return entries;
}

export function ExecLogPage() {
  const agents = mockTournamentState.agents;
  const [selectedId, setSelectedId] = useState("0xbeta_7x");
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.genome_id === selectedId) ?? agents[0],
    [agents, selectedId],
  );

  const logEntries = useMemo(() => buildLogs(selectedAgent), [selectedAgent]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [selectedId, logEntries]);

  return (
    <main className="page-shell exec-log-page">
      <section className="exec-log-layout">
        <aside className="panel exec-log-selector-panel">
          <div className="section-heading">
            <div className="panel-title">AGENT_SELECTOR</div>
            <div className="section-subtitle">KEEPERHUB_AUDIT_TRAIL</div>
          </div>
          <div className="exec-log-selector-list">
            {agents.map((agent) => {
              const active = agent.genome_id === selectedId;
              return (
                <button
                  key={agent.genome_id}
                  type="button"
                  className={`exec-log-selector-card${active ? " exec-log-selector-card-active" : ""}`}
                  onClick={() => setSelectedId(agent.genome_id)}
                >
                  <div className="exec-log-selector-top">
                    <span className="exec-log-selector-name">{shortName(agent.genome_id)}</span>
                    <StatusPill status={agent.status} />
                  </div>
                  <div className="exec-log-selector-sub">
                    GEN_{String(agent.generation).padStart(2, "0")} | FITNESS {agent.fitness_score.toFixed(1)}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel exec-log-viewer-panel">
          <div className="section-heading">
            <div className="panel-title">EXECUTION_LOG</div>
            <div className="section-subtitle">{selectedAgent.genome_id}</div>
          </div>
          <div className="exec-log-viewer" ref={viewerRef}>
            {logEntries.map((entry) => (
              <article key={`${entry.kind}-${entry.block}-${entry.round}`} className="exec-log-entry">
                <div className="exec-log-entry-header">
                  <span className="exec-log-block">[BLOCK {entry.block}]</span>
                  <span className="exec-log-meta">ROUND_{String(entry.round).padStart(2, "0")} :: {entry.kind}</span>
                </div>
                <div className="exec-log-lines">
                  {entry.lines.map(([label, value]) => (
                    <div key={`${entry.kind}-${entry.block}-${label}`} className="exec-log-line">
                      <span className="exec-log-field">{label}:</span>
                      <span className="exec-log-value">{value}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
