import { runAgentLoop } from "./loop";

const genomeId = process.argv[2] ?? "genesis-a";

void runAgentLoop(genomeId).then((result) => {
  console.log(JSON.stringify(result, null, 2));
});
