import { createArena } from "./arena";
import { startEvolutionLifecycle } from "./lifecycle";

void startEvolutionLifecycle(createArena()).then((state) => {
  console.log(JSON.stringify(state, null, 2));
});
