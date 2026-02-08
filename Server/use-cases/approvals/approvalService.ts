import { randomUUID } from "node:crypto";
import { Context, Effect, Layer, Ref } from "effect";
import type { Approval, ApprovalStatus } from "../../domain/approvals/types.js";
import { ApprovalAlreadyDecidedError, ApprovalNotFoundError } from "./errors.js";

export interface ApprovalCreateInput {
	requesterId: string;
	targetId: string;
	reason?: string | null;
}

export interface ApprovalService {
	create: (input: ApprovalCreateInput) => Effect.Effect<Approval>;
	updateStatus: (
		id: string,
		status: Extract<ApprovalStatus, "approved" | "rejected">,
	) => Effect.Effect<Approval, ApprovalNotFoundError | ApprovalAlreadyDecidedError>;
	list: () => Effect.Effect<Approval[]>;
}

export const ApprovalService = Context.GenericTag<ApprovalService>("ApprovalService");

const makeService = (store: Ref.Ref<Map<string, Approval>>): ApprovalService => ({
	create: (input) =>
		Effect.gen(function* () {
			const id = randomUUID();
			const approval: Approval = {
				id,
				requesterId: input.requesterId,
				targetId: input.targetId,
				reason: input.reason ?? null,
				status: "pending",
				createdAt: new Date().toISOString(),
				decidedAt: null,
			};
			const map = yield* Ref.get(store);
			map.set(id, approval);
			yield* Ref.set(store, map);
			return approval;
		}),

	updateStatus: (id, status) =>
		Effect.gen(function* () {
			const map = yield* Ref.get(store);
			const existing = map.get(id);
			if (!existing) {
				return yield* Effect.fail(new ApprovalNotFoundError({ id }));
			}
			if (existing.status !== "pending") {
				return yield* Effect.fail(new ApprovalAlreadyDecidedError({ id, status: existing.status }));
			}
			const updated: Approval = {
				...existing,
				status,
				decidedAt: new Date().toISOString(),
			};
			map.set(id, updated);
			yield* Ref.set(store, map);
			return updated;
		}),

	list: () =>
		Effect.gen(function* () {
			const map = yield* Ref.get(store);
			return Array.from(map.values()).sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
		}),
});

export const ApprovalServiceLive = Layer.effect(
	ApprovalService,
	Effect.gen(function* () {
		const store = yield* Ref.make(new Map<string, Approval>());
		return makeService(store);
	}),
);
