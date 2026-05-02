import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { AgentDetailPanel } from "../components/AgentDetailPanel";
import { GenomeDiffModal } from "../components/GenomeDiffModal";
import { EmptyState } from "../components/EmptyState";
import { useArenaStore } from "../state/arenaStore";
import type { Genome } from "../data/domain";

type GraphNode = {
  genome: Genome;
  children: GraphNode[];
};

type PositionedNode = d3.HierarchyPointNode<GraphNode>;

function shortName(genomeId: string) {
  const raw = genomeId.replace(/^0x/, "");
  const tail = raw.slice(-6).toUpperCase();
  const [first = "", second = ""] = tail.split("_");
  return second ? `${first}-${second}` : tail.length > 2 ? `${tail.slice(0, -2)}-${tail.slice(-2)}` : tail;
}

function buildGraph(agents: Genome[]) {
  const childrenByParent = new Map<string, Genome[]>();

  agents.forEach((agent) => {
    const primaryParent = agent.parent_ids[0];
    if (!primaryParent) return;
    const list = childrenByParent.get(primaryParent) ?? [];
    list.push(agent);
    childrenByParent.set(primaryParent, list);
  });

  const roots = agents.filter((agent) => agent.parent_ids.length === 0);
  const rootGenome: Genome = {
    genome_id: "__ROOT__",
    generation: -1,
    parent_ids: [],
    mutation_seed: "",
    mutation_rate_at_birth: 0,
    reasoning_strategy: "",
    tool_weights: {
      price_momentum: 0,
      volume_signal: 0,
      liquidity_depth: 0,
      volatility_index: 0,
      block_timing: 0,
    },
    risk_threshold: 0,
    memory_window: 0,
    created_at_block: 0,
    storage_key: "",
    nft_address: "",
    status: "EVOLVED",
    fitness_score: 0,
    fitness_history: [],
  };

  const buildNode = (genome: Genome): GraphNode => ({
    genome,
    children: (childrenByParent.get(genome.genome_id) ?? []).map((child) => buildNode(child)),
  });

  return {
    root: {
      genome: rootGenome,
      children: roots.map((root) => buildNode(root)),
    } satisfies GraphNode,
  };
}

function curvePath(source: { x: number; y: number }, target: { x: number; y: number }) {
  const midY = (source.y + target.y) / 2;
  return `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
}

export function LineagePage() {
  const {
    allGenomes,
    currentGenome,
    arenaId,
    setArenaId,
    createArena,
    runArena,
    runRound,
    loading,
    error,
  } = useArenaStore();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 780 });
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [showDead, setShowDead] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [draftArenaId, setDraftArenaId] = useState(arenaId);
  const [draftArenaSize, setDraftArenaSize] = useState(5);
  const [draftRunGenerations, setDraftRunGenerations] = useState(1);

  const selectedAgent = useMemo(() => {
    const id = selectedIds[selectedIds.length - 1];
    return allGenomes.find((agent) => agent.genome_id === id) ?? currentGenome ?? allGenomes[0] ?? null;
  }, [allGenomes, currentGenome, selectedIds]);

  const diffParent = selectedIds.length === 2 ? allGenomes.find((agent) => agent.genome_id === selectedIds[0]) : undefined;
  const diffDescendant = selectedIds.length === 2 ? allGenomes.find((agent) => agent.genome_id === selectedIds[1]) : undefined;

  useEffect(() => {
    const updateSize = () => {
      const width = svgRef.current?.parentElement?.clientWidth ?? 1200;
      setViewport({ width, height: 780 });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (svgRef.current?.parentElement) {
      resizeObserver.observe(svgRef.current.parentElement);
    }
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setDraftArenaId(arenaId);
  }, [arenaId]);

  const graph = useMemo(() => buildGraph(allGenomes), [allGenomes]);
  const hierarchy = useMemo(() => d3.hierarchy(graph.root), [graph.root]);
  const treeLayout = useMemo(() => d3.tree<GraphNode>().nodeSize([128, 150])(hierarchy), [hierarchy]);
  const positionedNodes = treeLayout.descendants() as PositionedNode[];
  const nodeMap = new Map(positionedNodes.map((node) => [node.data.genome.genome_id, node]));
  const visibleNodes = positionedNodes.filter(
    (node) => node.data.genome.genome_id !== "__ROOT__" && (showDead || node.data.genome.status !== "DEAD"),
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.data.genome.genome_id));

  const additionalEdges = allGenomes.flatMap((agent) =>
    agent.parent_ids.slice(1).flatMap((parentId) => {
      const source = nodeMap.get(parentId);
      const target = nodeMap.get(agent.genome_id);
      if (!source || !target) return [];
      if (!visibleIds.has(parentId) || !visibleIds.has(agent.genome_id)) return [];
      return [{ source, target, key: `${parentId}-${agent.genome_id}` }];
    }),
  );

  const primaryEdges = treeLayout.links().filter((link) => {
    const sourceGenome = link.source.data.genome;
    const targetGenome = link.target.data.genome;
    if (sourceGenome.genome_id === "__ROOT__" || targetGenome.genome_id === "__ROOT__") return false;
    return visibleIds.has(sourceGenome.genome_id) && visibleIds.has(targetGenome.genome_id);
  });

  const nodesOnly = visibleNodes.filter((node) => node.data.genome.genome_id !== "__ROOT__");
  const generationY = new Map<number, number>();
  nodesOnly.forEach((node) => {
    if (!generationY.has(node.data.genome.generation)) {
      generationY.set(node.data.genome.generation, node.y);
    }
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const selection = d3.select(svgRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 1.5])
      .on("zoom", (event) => setTransform(event.transform));

    zoomRef.current = zoom;
    selection.call(zoom);
    const centered = d3.zoomIdentity.translate(viewport.width / 2, 84).scale(1);
    selection.call(zoom.transform as any, centered as any);
    setTransform(centered);
  }, [viewport.width]);

  useEffect(() => {
    if (selectedIds.length === 2) {
      setDiffOpen(true);
    } else {
      setDiffOpen(false);
    }
  }, [selectedIds]);

  const minFitness = d3.min(nodesOnly, (node) => node.data.genome.fitness_score) ?? 0;
  const maxFitness = d3.max(nodesOnly, (node) => node.data.genome.fitness_score) ?? 1;
  const radiusScale = d3.scaleLinear().domain([minFitness, maxFitness]).range([18, 36]);
  const arrowColor = "rgba(0,255,204,0.3)";

  const handleNodeClick = (genomeId: string, shiftKey: boolean) => {
    setSelectedIds((current) => {
      if (!shiftKey) return [genomeId];
      const exists = current.includes(genomeId);
      if (exists) {
        return current.filter((id) => id !== genomeId);
      }
      return [...current, genomeId].slice(-2);
    });
  };

  const resetView = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const selection = d3.select(svgRef.current);
    const centered = d3.zoomIdentity.translate(viewport.width / 2, 84).scale(1);
    selection.transition().duration(250).call(zoomRef.current.transform as any, centered as any);
    setTransform(centered);
  };

  const handleCreateArena = async () => {
    await createArena(draftArenaId.trim() || arenaId, draftArenaSize);
  };

  const handleRunArena = async () => {
    await runArena(Math.max(1, draftRunGenerations));
  };

  const hasGenomes = allGenomes.length > 0;

  return (
    <main className="page-shell lineage-page">
      <div className="panel lineage-controls">
        <div className="section-heading">
          <div className="panel-title">LINEAGE_GRAPH</div>
          <div className="section-subtitle">D3_TREE_LAYOUT :: PARENT_TO_CHILD_EDGES</div>
        </div>
        <div className="lineage-controls-actions">
          <label className="lineage-control-field">
            <span className="ledger-filter-label">ARENA_ID</span>
            <input value={draftArenaId} onChange={(event) => setDraftArenaId(event.target.value)} />
          </label>
          <label className="lineage-control-field">
            <span className="ledger-filter-label">ARENA_SIZE</span>
            <input
              type="number"
              min={1}
              max={32}
              value={draftArenaSize}
              onChange={(event) => setDraftArenaSize(Number(event.target.value) || 5)}
            />
          </label>
          <button className="button button-primary" type="button" onClick={handleCreateArena}>
            [CREATE_ARENA]
          </button>
          <label className="lineage-control-field">
            <span className="ledger-filter-label">RUN_GENERATIONS</span>
            <input
              type="number"
              min={1}
              max={10}
              value={draftRunGenerations}
              onChange={(event) => setDraftRunGenerations(Number(event.target.value) || 1)}
            />
          </label>
          <button className="button" type="button" onClick={runRound}>
            [RUN_ROUND]
          </button>
          <button className="button" type="button" onClick={handleRunArena}>
            [RUN_ARENA]
          </button>
          <button className="button" type="button" onClick={() => setShowDead((value) => !value)}>
            [SHOW_DEAD] {showDead ? "ON" : "OFF"}
          </button>
          <button className="button" type="button" onClick={resetView}>
            [RESET_VIEW]
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={selectedIds.length !== 2}
            onClick={() => setDiffOpen(true)}
          >
            [GENOME_DIFF]
          </button>
        </div>
        {error ? <div className="lineage-error">{error}</div> : null}
      </div>

      <section className="lineage-grid">
        <article className="panel lineage-canvas-shell">
          {hasGenomes ? (
            <>
              <div className="lineage-canvas-pattern" />
              <div className="lineage-axis">
                {Array.from(generationY.entries()).map(([generation, y]) => (
                  <div
                    key={generation}
                    className="lineage-axis-label"
                    style={{ top: `${transform.applyY(y) - 10}px` }}
                  >
                    GEN_{String(generation).padStart(2, "0")}
                  </div>
                ))}
              </div>

              <svg ref={svgRef} className="lineage-svg" width="100%" height={viewport.height} role="img" aria-label="LINEAGE GRAPH">
                <defs>
                  <marker id="lineage-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill={arrowColor} />
                  </marker>
                </defs>
                <g transform={transform.toString()}>
                  {primaryEdges.map((link, index) => (
                    <path
                      key={`${link.source.data.genome.genome_id}-${link.target.data.genome.genome_id}-${index}`}
                      className="lineage-edge"
                      d={curvePath({ x: link.source.x, y: link.source.y }, { x: link.target.x, y: link.target.y })}
                      style={{
                        stroke: arrowColor,
                        strokeOpacity: Math.max(0.16, 0.28 - link.source.data.genome.generation * 0.04),
                      }}
                      markerEnd="url(#lineage-arrow)"
                    />
                  ))}
                  {additionalEdges.map((edge) => (
                    <path
                      key={edge.key}
                      className="lineage-edge lineage-edge-secondary"
                      d={curvePath({ x: edge.source.x, y: edge.source.y }, { x: edge.target.x, y: edge.target.y })}
                      style={{
                        stroke: "rgba(139,92,246,0.22)",
                      }}
                      markerEnd="url(#lineage-arrow)"
                    />
                  ))}

                  {nodesOnly.map((node) => {
                    const genome = node.data.genome;
                    const selected = selectedIds.includes(genome.genome_id);
                    const hidden = genome.status === "DEAD" && !showDead;
                    if (hidden) return null;

                    const radius = radiusScale(genome.fitness_score);
                    return (
                      <g
                        key={genome.genome_id}
                        className={`lineage-node lineage-node-${genome.status.toLowerCase()}${selected ? " lineage-node-selected" : ""}`}
                        transform={`translate(${node.x},${node.y})`}
                        onClick={(event) => handleNodeClick(genome.genome_id, event.shiftKey)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleNodeClick(genome.genome_id, event.shiftKey);
                          }
                        }}
                      >
                        {selected ? <circle className="lineage-node-ring" r={radius + 8} /> : null}
                        <circle className="lineage-node-core" r={radius} />
                        {genome.status === "DEAD" ? <text className="lineage-node-cross" y={4}>x</text> : null}
                        <text className="lineage-node-label" y={radius + 20}>
                          {shortName(genome.genome_id)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </>
          ) : (
            <EmptyState
              title={loading ? "LOADING_BACKEND_DATA" : "NO_GENOMES_AVAILABLE"}
              subtitle={loading ? "WAITING_FOR_REAL_ARENA_DATA_FROM_BACKEND" : "CREATE_AN_ARENA_TO_BEGIN_VISUALIZATION"}
            />
          )}
        </article>

        <aside className="lineage-side-panel">
          {selectedAgent ? (
            <AgentDetailPanel genome={selectedAgent} allAgents={allGenomes} readOnly />
          ) : (
            <EmptyState
              title={error ? "BACKEND_ERROR" : "ARENA_EMPTY"}
              subtitle={error ?? "CREATE_AN_ARENA_TO_BEGIN_INSPECTION"}
            />
          )}
        </aside>
      </section>

      {diffOpen && diffParent && diffDescendant ? (
        <GenomeDiffModal parent={diffParent} descendant={diffDescendant} onClose={() => setDiffOpen(false)} />
      ) : null}
    </main>
  );
}
