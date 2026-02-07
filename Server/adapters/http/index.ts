import { Hono } from "hono";
import type { ServerEnv } from "../../runtime/types.js";
import { goalsRoutes } from "./routes/goals/index.js";
import { healthRoutes } from "./routes/health/index.js";
import { llmRoutes } from "./routes/llm/index.js";
import { matchRoutes } from "./routes/match/index.js";
import { scheduleRoutes } from "./routes/schedule/index.js";
import { workloadRoutes } from "./routes/workload/index.js";

export const api = new Hono<ServerEnv>()
	.route("/health", healthRoutes)
	.route("/match", matchRoutes)
	.route("/schedule", scheduleRoutes)
	.route("/goals", goalsRoutes)
	.route("/workload", workloadRoutes)
	.route("/llm", llmRoutes);
