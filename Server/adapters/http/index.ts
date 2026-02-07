import { Hono } from "hono";
import type { ServerEnv } from "../../runtime/types.js";
import { healthRoutes } from "./routes/health/index.js";
import { matchRoutes } from "./routes/match/index.js";
import { scheduleRoutes } from "./routes/schedule/index.js";

export const api = new Hono<ServerEnv>()
	.route("/health", healthRoutes)
	.route("/match", matchRoutes)
	.route("/schedule", scheduleRoutes);
