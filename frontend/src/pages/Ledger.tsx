import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { useArenaStore } from "../state/arenaStore";
import type { TimelineRow } from "../state/arenaStore";

type EventTypeFilter = "ALL" | string;

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function formatPayload(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2);
}

const eventPillClass = (eventType: string) => {
  if (eventType === "arena.child.created" || eventType === "arena.genome.minted" || eventType === "arena.created") {
    return "ledger-pill-born";
  }
  if (eventType === "arena.genome.burned") {
    return "ledger-pill-dead";
  }
  if (eventType === "arena.agent.evaluated" || eventType === "arena.state.updated") {
    return "ledger-pill-fitness";
  }
  if (eventType === "arena.round.started" || eventType === "snapshot") {
    return "ledger-pill-generation";
  }
  return "ledger-pill-round";
};

const eventOptions = (rows: TimelineRow[]) => ["ALL", ...Array.from(new Set(rows.map((row) => row.type)))];

export function LedgerPage() {
  const { timelineRows } = useArenaStore();
  const [eventType, setEventType] = useState<EventTypeFilter>("ALL");
  const [generation, setGeneration] = useState<"ALL" | string>("ALL");
  const [agentQuery, setAgentQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return timelineRows.filter((event) => {
      if (eventType !== "ALL" && event.type !== eventType) return false;
      if (generation !== "ALL" && String(event.generation) !== generation) return false;
      if (agentQuery && !event.agent_id.toLowerCase().includes(agentQuery.toLowerCase())) return false;
      return true;
    });
  }, [agentQuery, eventType, generation, timelineRows]);

  const latestBlock = filteredEvents[filteredEvents.length - 1]?.block_number ?? timelineRows.at(-1)?.block_number ?? 0;

  return (
    <main className="page-shell ledger-page">
      <section className="panel ledger-filters-panel">
        <div className="section-heading">
          <div className="panel-title">EVENT_FILTERS</div>
          <div className="section-subtitle">CHRONOLOGICAL_LEDGER_STREAM</div>
        </div>
        <div className="ledger-filters-row">
          <label className="ledger-filter">
            <span className="ledger-filter-label">EVENT_TYPE</span>
            <select value={eventType} onChange={(event) => setEventType(event.target.value as EventTypeFilter)}>
              {eventOptions(timelineRows).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="ledger-filter">
            <span className="ledger-filter-label">GENERATION</span>
            <select value={generation} onChange={(event) => setGeneration(event.target.value)}>
              <option value="ALL">ALL</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label className="ledger-filter ledger-filter-wide">
            <span className="ledger-filter-label">AGENT_ID</span>
            <input
              value={agentQuery}
              onChange={(event) => setAgentQuery(event.target.value)}
              placeholder="SEARCH_AGENT_ID"
            />
          </label>
          <div className="ledger-filter-summary">
            <span>VISIBLE :: {filteredEvents.length}</span>
            <span>LATEST_BLOCK :: {latestBlock}</span>
          </div>
        </div>
      </section>

      <section className="panel ledger-table-panel">
        <div className="ledger-table-scroll">
          {filteredEvents.length ? (
            <table className="table ledger-table">
              <thead>
                <tr>
                  <th>BLOCK</th>
                  <th>TIMESTAMP</th>
                  <th>EVENT_TYPE</th>
                  <th>AGENT</th>
                  <th className="numeric">GEN</th>
                  <th className="numeric">ROUND</th>
                  <th>DATA</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const key = `${event.block_number}-${event.timestamp}-${event.agent_id}`;
                  const expanded = expandedKey === key;
                  return (
                    <Fragment key={key}>
                      <tr className="ledger-row" onClick={() => setExpandedKey((current) => (current === key ? null : key))}>
                        <td className="ledger-block">[BLOCK {event.block_number}]</td>
                        <td>{event.timestamp}</td>
                        <td>
                          <span className={`ledger-pill ${eventPillClass(event.type)}`}>{event.type}</span>
                        </td>
                        <td>{shortName(event.agent_id)}</td>
                        <td className="numeric">{String(event.generation).padStart(2, "0")}</td>
                        <td className="numeric">{String(event.round).padStart(2, "0")}</td>
                        <td className="ledger-data-preview">{expanded ? "EXPANDED" : formatPayload(event.data).split("\n")[0]}</td>
                      </tr>
                      {expanded ? (
                        <tr className="ledger-expanded-row">
                          <td colSpan={7}>
                            <pre className="ledger-json">{formatPayload(event.data)}</pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState title="NO_MATCHING_EVENTS" subtitle="ADJUST_FILTERS_TO_VIEW_THE_LEDGER_STREAM" />
          )}
        </div>
      </section>
    </main>
  );
}
