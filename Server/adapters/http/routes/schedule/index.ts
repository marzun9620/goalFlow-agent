import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import { TaskNotFoundError } from "../../../../domain/matching/errors.js";
import {
	type ServerEnv,
	conflict,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import {
	NoScheduleAvailableError,
	SchedulingFlowError,
} from "../../../../use-cases/scheduling/errors.js";
import { ProposeScheduleUseCase } from "../../../../use-cases/scheduling/proposeScheduleUseCase.js";
import { type ScheduleRequest, ScheduleRequestSchema } from "./schemas.js";

export const scheduleRoutes = new Hono<ServerEnv>().post(
	"/propose",
	effectValidator("json", ScheduleRequestSchema),
	async (c) => {
		const body = c.req.valid("json") as ScheduleRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ProposeScheduleUseCase;
					return yield* service.propose(body.taskId, {
						startDate: body.preferredDateRange?.start,
						endDate: body.preferredDateRange?.end,
						maxResults: body.maxResults,
					});
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
	if (error instanceof NoScheduleAvailableError) {
		return conflict({ detail: "No available schedule within the requested range." });
	}
	if (error instanceof SchedulingFlowError) {
		return internalServerError({ detail: error.message });
	}
	return null;
};
