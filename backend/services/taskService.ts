import { createAgentTask, type CreateAgentTaskOptions } from "../../core/types/task";

const buildDefaultTask = (): CreateAgentTaskOptions => ({
  context: {
    poolAddress: process.env.TARGET_POOL_ADDRESS ?? "demo-pool",
    roundWindowBlocks: 20
  }
});

const normalizeTaskOptions = (
  options: Partial<CreateAgentTaskOptions> & { context?: CreateAgentTaskOptions["context"] }
): CreateAgentTaskOptions => ({
  ...buildDefaultTask(),
  ...options,
  context: options.context ?? buildDefaultTask().context
});

export const taskService = {
  createTask: (options: Partial<CreateAgentTaskOptions> & { context?: CreateAgentTaskOptions["context"] }) =>
    createAgentTask(normalizeTaskOptions(options)),
  createDefaultTask: () => createAgentTask(buildDefaultTask())
};