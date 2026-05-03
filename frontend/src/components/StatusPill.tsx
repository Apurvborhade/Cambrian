import type { Genome } from "../data/domain";

const STATUS_CLASS: Record<Genome["status"], string> = {
  ALIVE: "status-pill-alive",
  DEAD: "status-pill-dead",
  SELECTED: "status-pill-selected",
  EVOLVED: "status-pill-evolved",
};

export function StatusPill({ status }: { status: Genome["status"] }) {
  return <span className={`status-pill ${STATUS_CLASS[status]}`}>{status}</span>;
}
