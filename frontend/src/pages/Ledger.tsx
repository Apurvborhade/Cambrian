import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { GenerationEvent } from "../data/mockData";
import { MOCK_GENERATION_EVENTS } from "../data/mockData";

type EventTypeFilter = "ALL" | GenerationEvent["event_type"];

const EVENT_TYPE_OPTIONS: EventTypeFilter[] = [
  "ALL",
  "AGENT_BORN",
  "AGENT_DIED",
  "FITNESS_UPDATED",
  "GENERATION_STARTED",
  "ROUND_COMPLETE",
];

const EVENT_PILL_CLASS: Record<GenerationEvent["event_type"], string> = {
  AGENT_BORN: "ledger-pill-born",
  AGENT_DIED: "ledger-pill-dead",
  FITNESS_UPDATED: "ledger-pill-fitness",
  GENERATION_STARTED: "ledger-pill-generation",
  ROUND_COMPLETE: "ledger-pill-round",
};

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [left = "", right = ""] = tail.split("_");
  return right ? `${left}-${right}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function formatPayload(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2);
}

function cloneAndSimulate(event: GenerationEvent, index: number): GenerationEvent {
  return {
    ...event,
    block_number: event.block_number + index + 1,
    timestamp: new Date(Date.now() + index * 1000).toISOString(),
    data: {
      ...event.data,
      simulated: true,
      tick: index + 1,
    },
  };
}

export function LedgerPage() {
  const [events, setEvents] = useState<GenerationEvent[]>(MOCK_GENERATION_EVENTS);
  const [eventType, setEventType] = useState<EventTypeFilter>("ALL");
  const [generation, setGeneration] = useState<"ALL" | string>("ALL");
  const [agentQuery, setAgentQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setEvents((current) => {
        const base = current[current.length - 1] ?? MOCK_GENERATION_EVENTS[MOCK_GENERATION_EVENTS.length - 1];
        const next = cloneAndSimulate(base, current.length);
        return [...current, next];
      });
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (eventType !== "ALL" && event.event_type !== eventType) return false;
      if (generation !== "ALL" && String(event.generation) !== generation) return false;
      if (agentQuery && !event.agent_id.toLowerCase().includes(agentQuery.toLowerCase())) return false;
      return true;
    });
  }, [agentQuery, eventType, events, generation]);

  const latestBlock = filteredEvents[filteredEvents.length - 1]?.block_number ?? events[events.length - 1]?.block_number ?? 0;

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
              {EVENT_TYPE_OPTIONS.map((option) => (
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
        <div className="ledger-table-scroll" ref={scrollRef}>
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
                    <tr
                      className="ledger-row"
                      onClick={() => setExpandedKey((current) => (current === key ? null : key))}
                    >
                      <td className="ledger-block">[BLOCK {event.block_number}]</td>
                      <td>{event.timestamp}</td>
                      <td>
                        <span className={`ledger-pill ${EVENT_PILL_CLASS[event.event_type]}`}>{event.event_type}</span>
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
        </div>
      </section>
    </main>
  );
}
