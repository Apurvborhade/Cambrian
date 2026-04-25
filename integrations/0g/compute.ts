import type { AgentContext, AgentAction } from "../../core/types/agent";

export class ZeroGComputeAdapter {
  public async reason(context: AgentContext): Promise<AgentAction> {
    const confidence = Math.min(
      1,
      (context.signals.priceMomentum + context.signals.volumeSignal + context.signals.liquidityDepth) / 3
    );

    return {
      type: confidence >= context.genome.risk_threshold ? "swap" : "observe",
      direction: confidence >= 0.55 ? "long" : "flat",
      confidence,
      rationale: `Generated placeholder action for ${context.genome.genome_id}.`
    };
  }
}
