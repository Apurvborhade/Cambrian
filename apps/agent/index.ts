import { runAgentLoop } from "./loop";

const genomeId = process.argv[2] ?? "genesis-a";

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const main = async (): Promise<void> => {
  const result = await runAgentLoop(genomeId);
  console.log(JSON.stringify(result, null, 2));
};

void main().catch((error: unknown) => {
  console.error(`Agent run failed: ${formatError(error)}`);
  process.exitCode = 1;
});
