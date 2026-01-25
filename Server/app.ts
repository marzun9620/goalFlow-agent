import { Hono } from "hono";
import type { HealthResponse, VersionResponse } from "./domain/schemas.js";
import {
	authStubMiddleware,
	errorHandlingMiddleware,
	loggerMiddleware,
	rateLimitStubMiddleware,
	requestIdMiddleware,
} from "./middleware.js";
import { createRequire } from "node:module";

export function createApp() {
	const app = new Hono();

	app.use("*", requestIdMiddleware);
	app.use("*", errorHandlingMiddleware);
	app.use("*", loggerMiddleware);
	app.use("*", authStubMiddleware);
	app.use("*", rateLimitStubMiddleware);

	app.get("/health", (c) => c.json<HealthResponse>({ status: "ok" }, 200));

	const require = createRequire(import.meta.url);
	const { version } = require("./package.json") as { version: string };
	app.get("/version", (c) => c.json<VersionResponse>({ version }, 200));

	return app;
}
