import { Router } from "express";
import {
  createArenaHandler,
  getArenaAgentsHandler,
  getArenaHandler,
  getArenaStateHandler,
  healthHandler,
  runArenaHandler,
  runArenaRoundHandler
} from "../controllers/arenaController";

export const arenaRouter = Router();

arenaRouter.get("/health", healthHandler);
arenaRouter.post("/arenas", createArenaHandler);
arenaRouter.get("/arenas/:arenaId", getArenaHandler);
arenaRouter.get("/arenas/:arenaId/state", getArenaStateHandler);
arenaRouter.get("/arenas/:arenaId/agents", getArenaAgentsHandler);
arenaRouter.post("/arenas/:arenaId/rounds", runArenaRoundHandler);
arenaRouter.post("/arenas/:arenaId/run", runArenaHandler);