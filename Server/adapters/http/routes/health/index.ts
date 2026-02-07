import { Hono } from "hono";
import type { ServerEnv } from "../../../../runtime/types.js";

export const healthRoutes = new Hono<ServerEnv>()
	.get("/health", (c) => c.json({ status: "ok" }, 200))
	.get("/version", async (c) => {
		const { version } = await import("../../../../package.json", {
			assert: { type: "json" },
		});
		return c.json({ version }, 200);
	});
