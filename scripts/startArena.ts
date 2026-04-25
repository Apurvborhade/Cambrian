import { createArena } from "../apps/orchestrator/arena";
import { startEvolutionLifecycle } from "../apps/orchestrator/lifecycle";

void startEvolutionLifecycle(createArena()).then((state) => {
  console.log(JSON.stringify(state, null, 2));
});
