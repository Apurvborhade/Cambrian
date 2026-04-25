import { runGeneration } from "../core/evolution/engine";

const result = runGeneration(
  0,
  {
    generation: 0,
    rankings: [
      { agentId: "genesis-a", totalScore: 4.2 },
      { agentId: "genesis-b", totalScore: 3.4 },
      { agentId: "genesis-c", totalScore: 2.8 },
      { agentId: "genesis-d", totalScore: 2.1 },
      { agentId: "genesis-e", totalScore: 0.4 }
    ]
  },
  2,
  1
);

console.log(JSON.stringify(result, null, 2));
