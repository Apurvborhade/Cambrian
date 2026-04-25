import type { AgentContext, AgentAction } from "../../core/types/agent";
import { ZeroGComputeAdapter } from "../../integrations/0g/compute";

export const runReasoning = async (
  compute: ZeroGComputeAdapter,
  context: AgentContext
): Promise<AgentAction> => compute.reason(context);
