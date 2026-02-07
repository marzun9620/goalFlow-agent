import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { healthRoutes } from "./adapters/http/routes/health/index.js";
import type { ServerEnv } from "./runtime/types.js";

const buildTestApp = () => new Hono<ServerEnv>().route("/api", healthRoutes);

describe("API app", () => {
	it("health check returns ok status", async () => {
		const app = buildTestApp();
		const req = new Request("http://localhost/api/health");
		const res = await app.fetch(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual({ status: "ok" });
	});

	it("returns version info", async () => {
		const app = buildTestApp();
		const req = new Request("http://localhost/api/version");
		const res = await app.fetch(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(typeof data.version).toBe("string");
		expect(data.version.length).toBeGreaterThan(0);
	});
});
