import { Router } from "express";
import { createTaskHandler } from "../controllers/taskController";

export const taskRouter = Router();

taskRouter.post("/tasks", createTaskHandler);