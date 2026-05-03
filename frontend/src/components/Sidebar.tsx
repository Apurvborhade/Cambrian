import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { icon: "◇", label: "HOME", to: "/" },
  { icon: "⬡", label: "SWARM", to: "/swarm" },
  { icon: "◎", label: "LINEAGE", to: "/lineage" },
  { icon: "◈", label: "GENOME_LAB", to: "/genome" },
  { icon: "◭", label: "TOURNAMENT", to: "/tournament" },
  { icon: "≡", label: "LEDGER", to: "/ledger" },
  { icon: "▣", label: "GENERATION", to: "/generation" },
  { icon: "◉", label: "EXEC_LOG", to: "/logs" },
  { icon: "⚙", label: "SYSTEM_OS", to: "/settings" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-mark">DP</div>
      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " sidebar-link-active" : ""}`
            }
            end={item.to === "/"}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
