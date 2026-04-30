import { Link } from "react-router-dom";

const HIGHLIGHTS = [
  "ON_CHAIN_EVOLUTION_VISUALIZED",
  "GENOMES_TRACED_ACROSS_GENERATIONS",
  "LIVE_TOURNAMENT_AND_LEDGER_VIEWS",
];

export function LandingPage() {
  return (
    <main className="page-shell landing-page">
      <section className="landing-shell">
        <div className="landing-kicker">DARWIN_PROTOCOL</div>
        <h1 className="landing-title">
          EVOLUTION
          <span>AS_A_LIVE_SYSTEM</span>
        </h1>
        <p className="landing-copy">
          Observe agents born from genomes, compete in tournaments, and reproduce through
          crossover. This front end is the control surface for inheritance, fitness, and lineage.
        </p>

        <div className="landing-actions">
          <Link className="button button-primary" to="/swarm">
            ENTER_SWARM
          </Link>
          <Link className="button" to="/lineage">
            VIEW_LINEAGE
          </Link>
        </div>

        <div className="landing-strip">
          {HIGHLIGHTS.map((item) => (
            <div key={item} className="landing-chip">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
