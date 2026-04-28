import { createApp } from "./app";

const port = Number.parseInt(process.env.BACKEND_PORT ?? process.env.PORT ?? "3001", 10);

const app = createApp();

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});