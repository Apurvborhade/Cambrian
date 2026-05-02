import type { Genome } from "../data/domain";

type DiffToken = {
  text: string;
  kind: "added" | "removed" | "same";
};

function tokenize(text: string) {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function computeDiff(parent: string, descendant: string) {
  const left = tokenize(parent);
  const right = tokenize(descendant);
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        left[i] === right[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      tokens.push({ text: left[i], kind: "same" });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ text: left[i], kind: "removed" });
      i += 1;
    } else {
      tokens.push({ text: right[j], kind: "added" });
      j += 1;
    }
  }

  while (i < left.length) {
    tokens.push({ text: left[i], kind: "removed" });
    i += 1;
  }

  while (j < right.length) {
    tokens.push({ text: right[j], kind: "added" });
    j += 1;
  }

  return tokens;
}

function renderDiff(tokens: DiffToken[], mode: "parent" | "descendant") {
  return tokens.map((token, index) => {
    const className = (() => {
      if (token.kind === "same") return "diff-token";
      if (mode === "parent" && token.kind === "removed") return "diff-token diff-token-removed";
      if (mode === "descendant" && token.kind === "added") return "diff-token diff-token-added";
      return "diff-token diff-token-muted";
    })();
    return (
      <span key={`${token.text}-${index}`} className={className}>
        {token.text}
      </span>
    );
  });
}

function renderGenomeRef(genomeId: string) {
  const suffix = genomeId.split("_").at(-1)?.toUpperCase() ?? genomeId.toUpperCase();
  return `#241-${suffix}`;
}

function geneRows(parent: Genome, descendant: Genome) {
  return [
    ["RISK_THRESHOLD", parent.risk_threshold, descendant.risk_threshold],
    ["MEMORY_WINDOW", parent.memory_window, descendant.memory_window],
    ["PRICE_MOMENTUM", parent.tool_weights.price_momentum, descendant.tool_weights.price_momentum],
    ["VOLUME_SIGNAL", parent.tool_weights.volume_signal, descendant.tool_weights.volume_signal],
    ["LIQUIDITY_DEPTH", parent.tool_weights.liquidity_depth, descendant.tool_weights.liquidity_depth],
    ["VOLATILITY_INDEX", parent.tool_weights.volatility_index, descendant.tool_weights.volatility_index],
    ["BLOCK_TIMING", parent.tool_weights.block_timing, descendant.tool_weights.block_timing],
  ] as const;
}

export function GenomeDiffModal({
  parent,
  descendant,
  onClose,
}: {
  parent: Genome;
  descendant: Genome;
  onClose: () => void;
}) {
  const diffTokens = computeDiff(parent.reasoning_strategy, descendant.reasoning_strategy);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-shell panel"
        role="dialog"
        aria-modal="true"
        aria-label="STRATEGY_EVOLUTION_DIFF"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="panel-title">STRATEGY_EVOLUTION_DIFF</div>
            <div className="modal-subtitle">
              {renderGenomeRef(parent.genome_id)} :: {renderGenomeRef(descendant.genome_id)}
            </div>
          </div>
          <button className="button" type="button" onClick={onClose}>
            CLOSE
          </button>
        </div>

        <div className="diff-grid">
          <section className="diff-column">
            <div className="panel-title">PARENT_GENOME</div>
            <div className="diff-body diff-body-parent">{renderDiff(diffTokens, "parent")}</div>
          </section>

          <section className="diff-column">
            <div className="panel-title">DESCENDANT_GENOME</div>
            <div className="diff-body diff-body-descendant">{renderDiff(diffTokens, "descendant")}</div>
          </section>
        </div>

        <div className="gene-diff-table">
          {geneRows(parent, descendant).map(([label, oldValue, newValue]) => {
            const delta = Number(newValue) - Number(oldValue);
            const deltaClass =
              delta > 0 ? "delta-positive" : delta < 0 ? "delta-negative" : "delta-neutral";
            const oldText = typeof oldValue === "number" ? oldValue.toFixed(2) : String(oldValue);
            const newText = typeof newValue === "number" ? newValue.toFixed(2) : String(newValue);
            return (
              <div key={label} className="gene-diff-row">
                <span className="gene-diff-label">{label}</span>
                <span className={`gene-diff-value ${deltaClass}`}>
                  {oldText} <span className="delta-sep">→</span> {newText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
