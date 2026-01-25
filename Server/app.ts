import { createRequire } from "node:module";
import { Hono } from "hono";
import type { HealthResponse, VersionResponse } from "./domain/schemas.js";
import { createRequestMiddlewares } from "./request-middlewares.js";

export function createApp() {
	const app = new Hono();

	const middlewares = createRequestMiddlewares();
	app.use("*", middlewares.requestId);
	app.onError(middlewares.onError);
	app.use("*", middlewares.errorHandler);
	app.use("*", middlewares.logger);
	app.use("*", middlewares.authStub);
	app.use("*", middlewares.rateLimitStub);

	app.get("/health", (c) => c.json<HealthResponse>({ status: "ok" }, 200));

	const require = createRequire(import.meta.url);
	const { version } = require("./package.json") as { version: string };
	app.get("/version", (c) => c.json<VersionResponse>({ version }, 200));

	return app;
}
