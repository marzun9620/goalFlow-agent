import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Effect, ManagedRuntime } from "effect";
import { Hono } from "hono";
import { api } from "./adapters/http/index.js";
import { AppConfig } from "./runtime/config.js";
import { AppLayer, type AppServices } from "./runtime/layer.js";
import { HttpError, type ServerEnv, respond } from "./runtime/types.js";

const managedRuntime = ManagedRuntime.make(AppLayer);

export const createServer = async () => {
	const config = await managedRuntime.runPromise(AppConfig);

	const app = new Hono<ServerEnv>();

	app.use("*", async (c, next) => {
		const requestId = c.req.header("x-request-id") ?? randomUUID();
		c.set("requestId", requestId);
		c.header("x-request-id", requestId);

		c.set("run", <A, E>(eff: Effect.Effect<A, E, AppServices>) => managedRuntime.runPromise(eff));

		const start = performance.now();
		try {
			await next();
		} finally {
			const elapsed = (performance.now() - start).toFixed(1);
			// eslint-disable-next-line no-console
			console.log(`[${requestId}] ${c.req.method} ${c.req.path} -> ${c.res.status} (${elapsed}ms)`);
		}
	});

	app.route("/api", api);

	app.onError((err, c) => {
		if (err instanceof HttpError) {
			return respond(c, err);
		}
		return respond(
			c,
			new HttpError({
				status: 500,
				title: "Internal Server Error",
				detail: err instanceof Error ? err.message : "Unexpected error",
			}),
		);
	});

	const server = serve({
		fetch: app.fetch,
		port: config.port,
	});

	// eslint-disable-next-line no-console
	console.log(`API running on http://localhost:${config.port}`);

	return { server };
};

export const serverProgram = Effect.promise(createServer);
