import { Router } from "express";
import { listAgentsHandler, registerAgentHandler } from "../controllers/agentController";

export const agentRouter = Router();

agentRouter.get("/agents", listAgentsHandler);
agentRouter.post("/agents/register", registerAgentHandler);
agentRouter.post("/agents/heartbeat", registerAgentHandler);