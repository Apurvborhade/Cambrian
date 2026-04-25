import { broadcastTask } from "./broadcast";

void broadcastTask().then((task) => {
  console.log(JSON.stringify(task, null, 2));
});
