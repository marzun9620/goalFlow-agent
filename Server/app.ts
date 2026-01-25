import * as S from "@effect/schema/Schema";
import { Hono } from "hono";
import { HealthResponseSchema, VersionResponseSchema } from "./domain/schemas.js";
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

	app.get("/health", (c) => {
		const body: S.Schema.To<typeof HealthResponseSchema> = { status: "ok" };
		return c.json(body, 200);
	});

	const require = createRequire(import.meta.url);
	const { version } = require("./package.json") as { version: string };
	app.get("/version", (c) => {
		const body: S.Schema.To<typeof VersionResponseSchema> = { version };
		return c.json(body, 200);
	});

	return app;
}
