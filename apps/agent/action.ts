import type { AgentAction } from "../../core/types/agent";
import type { AgentGenome } from "../../core/types/genome";

export const finalizeAction = (action: AgentAction, genome: AgentGenome): AgentAction => {
  if (action.confidence < genome.risk_threshold) {
    return {
      ...action,
      type: "observe",
      direction: "flat",
      rationale: `${action.rationale} Confidence below threshold, switching to observe.`
    };
  }

  return action;
};
