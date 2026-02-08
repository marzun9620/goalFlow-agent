import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	badRequest,
	internalServerError,
	respond,
	tooManyRequests,
} from "../../../../runtime/types.js";
import {
	GuardrailViolationError,
	RateLimitExceededError,
} from "../../../../use-cases/llm/errors.js";
import { LlmService } from "../../../../use-cases/llm/llmService.js";
import { type JustifyRequest, JustifyRequestSchema } from "./schemas.js";

export const llmRoutes = new Hono<ServerEnv>().post(
	"/justify",
	effectValidator("json", JustifyRequestSchema),
	async (c) => {
		const body = c.req.valid("json") as JustifyRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* LlmService;
					return yield* service.justifyMatch(body);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			// Temporary: surface errors to logs for easier debugging
			console.error("/api/llm/justify failed", error);
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	},
);

const toProblem = (error: unknown) => {
	if (error instanceof GuardrailViolationError) {
		return badRequest({ detail: "Guardrail violation", extensions: { issues: error.issues } });
	}
	if (error instanceof RateLimitExceededError) {
		return tooManyRequests({ detail: "Rate limit exceeded" });
	}
	return null;
};
