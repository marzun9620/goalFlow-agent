import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ConnectorsService, ConnectorsServiceStubLive } from "./connectorsService.js";

const run = <A, E>(eff: Effect.Effect<A, E, ConnectorsService>) =>
	Effect.runPromise(eff.pipe(Effect.provide(ConnectorsServiceStubLive), Effect.either));

describe("ConnectorsService", () => {
	it("syncs calendar via stub", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ConnectorsService;
				return yield* svc.syncCalendar("person-1", new Date("2026-02-10"), new Date("2026-02-11"));
			}),
		);
		expect(result._tag).toBe("Right");
		if (result._tag === "Right") {
			expect(result.right.provider).toContain("google");
			expect(result.right.itemsSynced).toBeGreaterThan(0);
		}
	});

	it("sends notification", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ConnectorsService;
				return yield* svc.sendNotification({
					channel: "slack",
					target: "#general",
					message: "hello",
				});
			}),
		);
		expect(result._tag).toBe("Right");
		if (result._tag === "Right") {
			expect(result.right.id).toContain("stub");
		}
	});
});
