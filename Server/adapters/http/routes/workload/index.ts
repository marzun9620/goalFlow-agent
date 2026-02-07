import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	badRequest,
	internalServerError,
	respond,
} from "../../../../runtime/types.js";
import { GoalPlanningError } from "../../../../use-cases/goals/errors.js";
import { GoalService } from "../../../../use-cases/goals/goalService.js";

export const workloadRoutes = new Hono<ServerEnv>().get("/summary", async (c) => {
	try {
		const result = await c.var.run(
			Effect.gen(function* () {
				const service = yield* GoalService;
				return yield* service.workloadSummary();
			}),
		);
		return c.json(result, 200);
	} catch (error) {
		const problem =
			error instanceof GoalPlanningError
				? badRequest({ detail: "Unable to compute workload summary." })
				: internalServerError("Unexpected error");
		return respond(c, problem);
	}
});
