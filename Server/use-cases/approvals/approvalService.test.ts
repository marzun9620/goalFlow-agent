import { Effect, Layer } from "effect";
import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import { ApprovalService, ApprovalServiceLive } from "./approvalService.js";
import { ApprovalAlreadyDecidedError, ApprovalNotFoundError } from "./errors.js";

const run = <A, E>(eff: Effect.Effect<A, E, ApprovalService>) =>
	Effect.runPromise(eff.pipe(Effect.provide(ApprovalServiceLive), Effect.either));

describe("ApprovalService", () => {
	it("creates an approval", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ApprovalService;
				return yield* svc.create({
					requesterId: "u1",
					targetId: "task-1",
					reason: "Need approval",
				});
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.status).toBe("pending");
		}
	});

	it("approves a pending request", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ApprovalService;
				const created = yield* svc.create({ requesterId: "u1", targetId: "task-1" });
				return yield* svc.updateStatus(created.id, "approved");
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.status).toBe("approved");
		}
	});

	it("fails when approving twice", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ApprovalService;
				const created = yield* svc.create({ requesterId: "u1", targetId: "task-1" });
				yield* svc.updateStatus(created.id, "approved");
				return yield* svc.updateStatus(created.id, "approved");
			}),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(ApprovalAlreadyDecidedError);
		}
	});

	it("fails when approval missing", async () => {
		const result = await run(
			Effect.gen(function* () {
				const svc = yield* ApprovalService;
				return yield* svc.updateStatus("missing", "approved");
			}),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(ApprovalNotFoundError);
		}
	});
});
