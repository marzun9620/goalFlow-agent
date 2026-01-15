import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("API app", () => {
	it("health check returns ok status", async () => {
		const app = createApp();
		const req = new Request("http://localhost/health");
		const res = await app.fetch(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual({ status: "ok" });
	});
});
