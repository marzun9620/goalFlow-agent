import { Effect, Layer } from "effect";
import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import type { LlmAdapter } from "./adapter.js";
import { LlmAdapter as LlmAdapterTag } from "./adapter.js";
import { GuardrailViolationError, RateLimitExceededError } from "./errors.js";
import type { Guardrails } from "./guardrails.js";
import { GuardrailsLive, Guardrails as GuardrailsTag } from "./guardrails.js";
import { LlmService, LlmServiceLive } from "./llmService.js";

const mockGuardrails = (impl: Partial<Guardrails>): Layer.Layer<Guardrails> =>
	Layer.succeed(GuardrailsTag, {
		check: () => Effect.succeed({ passed: true, issues: [] }),
		enforce: () => Effect.succeed(undefined),
		rateLimit: () => Effect.succeed(undefined),
		...impl,
	} as Guardrails);

const mockAdapter = (text: string): Layer.Layer<LlmAdapter> =>
	Layer.succeed(LlmAdapterTag, {
		complete: () =>
			Effect.succeed({
				text,
				usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
			}),
	});

const run = <A, E>(
	layer: Layer.Layer<Guardrails | LlmAdapter>,
	effect: Effect.Effect<A, E, LlmService>,
) =>
	Effect.runPromise(
		effect.pipe(Effect.provide(Layer.provideMerge(LlmServiceLive, layer)), Effect.either),
	);

describe("LlmService", () => {
	it("returns justification text", async () => {
		const layer = Layer.mergeAll(mockGuardrails({}), mockAdapter("Because Alice is great"));

		const result = await run(
			layer,
			Effect.gen(function* () {
				const service = yield* LlmService;
				return yield* service.justifyMatch({
					personName: "Alice",
					taskTitle: "Build API",
					capacityScore: 0.8,
					skillScore: 0.9,
				});
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.text).toContain("Because");
		}
	});

	it("fails on guardrail violation", async () => {
		const layer = Layer.mergeAll(
			mockGuardrails({
				enforce: () =>
					Effect.fail(new GuardrailViolationError({ issues: [{ type: "pii", span: "email" }] })),
			}),
			mockAdapter("ok"),
		);

		const result = await run(
			layer,
			Effect.gen(function* () {
				const service = yield* LlmService;
				return yield* service.justifyMatch({
					personName: "Bob",
					taskTitle: "Task",
					capacityScore: 0.5,
					skillScore: 0.5,
				});
			}),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(GuardrailViolationError);
		}
	});

	it("fails on rate limit", async () => {
		const layer = Layer.mergeAll(
			mockGuardrails({
				rateLimit: () => Effect.fail(new RateLimitExceededError({})),
			}),
			mockAdapter("ok"),
		);

		const result = await run(
			layer,
			Effect.gen(function* () {
				const service = yield* LlmService;
				return yield* service.justifyMatch({
					personName: "Bob",
					taskTitle: "Task",
					capacityScore: 0.5,
					skillScore: 0.5,
				});
			}),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(RateLimitExceededError);
		}
	});
});
