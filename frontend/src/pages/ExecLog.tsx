import { useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { useArenaStore } from "../state/arenaStore";

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

export function ExecLogPage() {
  const { allGenomes, timelineRows } = useArenaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent = useMemo(
    () => allGenomes.find((agent) => agent.genome_id === selectedId) ?? allGenomes[0] ?? null,
    [allGenomes, selectedId],
  );

  const logEntries = useMemo(() => {
    if (!selectedAgent) return [];
    const agentRows = timelineRows.filter((row) => row.agent_id === selectedAgent.genome_id);
    return agentRows.map((row) => ({
      block: row.block_number,
      round: row.round,
      kind: row.type,
      lines: Object.entries(row.data).map(
        ([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)] as [string, string],
      ),
    }));
  }, [selectedAgent, timelineRows]);

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
            {allGenomes.map((agent) => {
              const active = agent.genome_id === (selectedId ?? selectedAgent?.genome_id);
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
            <div className="section-subtitle">{selectedAgent?.genome_id ?? "--"}</div>
          </div>
          {logEntries.length ? (
            <div className="exec-log-viewer" ref={viewerRef}>
              {logEntries.map((entry) => (
                <article key={`${entry.kind}-${entry.block}-${entry.round}`} className="exec-log-entry">
                  <div className="exec-log-entry-header">
                    <span className="exec-log-block">[BLOCK {entry.block}]</span>
                    <span className="exec-log-meta">
                      ROUND_{String(entry.round).padStart(2, "0")} :: {entry.kind}
                    </span>
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
          ) : (
            <EmptyState title="NO_EXEC_LOGS" subtitle="RUN_AN_ARENA_TO_POPULATE_EXECUTION_EVENTS" />
          )}
        </section>
      </section>
    </main>
  );
}
