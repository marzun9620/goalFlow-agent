import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import { NoSuitableCandidateError, TaskNotFoundError } from "../../../../domain/matching/errors.js";
import {
	type ServerEnv,
	conflict,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import { MatchingFlowError } from "../../../../use-cases/matching/errors.js";
import { MatchEmployeeUseCase } from "../../../../use-cases/matching/matchEmployeeUseCase.js";
import { type MatchRequest, MatchRequestSchema } from "./schemas.js";

export const matchRoutes = new Hono<ServerEnv>().post(
	"/",
	effectValidator("json", MatchRequestSchema),
	async (c) => {
		const body = c.req.valid("json") as MatchRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* MatchEmployeeUseCase;
					return yield* service.match(body.taskId);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	},
);

const toProblem = (error: unknown) => {
	if (error instanceof TaskNotFoundError) {
		return notFound({ detail: `Task ${error.taskId} not found.` });
	}
	if (error instanceof NoSuitableCandidateError) {
		return conflict({ detail: "No suitable candidate found for this task." });
	}
	if (error instanceof MatchingFlowError) {
		return internalServerError({ detail: error.message });
	}
	return null;
};
