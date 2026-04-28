import cors from "cors";
import express from "express";
import { arenaRouter } from "./routes/arenaRoutes";
import { taskRouter } from "./routes/taskRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", arenaRouter);
  app.use("/api", taskRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};