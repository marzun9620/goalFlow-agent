import { createApp } from "./app";
import { describe, expect, it } from "vitest";

describe("API app", () => {
	it("health check returns ok status", async () => {
		const app = createApp();
		const req = new Request("http://localhost/health");
		const res = await app.fetch(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual({ status: "ok" });
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("returns version info", async () => {
		const app = createApp();
		const req = new Request("http://localhost/version");
		const res = await app.fetch(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(typeof data.version).toBe("string");
		expect(data.version.length).toBeGreaterThan(0);
	});

	it("wraps unhandled errors with json body and request id", async () => {
		const app = createApp();
		app.get("/boom", () => {
			throw new Error("boom");
		});
		const res = await app.fetch(new Request("http://localhost/boom"));
		const data = await res.json();

		expect(res.status).toBe(500);
		expect(data.error).toBe("boom");
		expect(data.requestId).toBeTruthy();
	});
});
