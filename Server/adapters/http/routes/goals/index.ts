import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	badRequest,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import { GoalNotFoundError, GoalPlanningError } from "../../../../use-cases/goals/errors.js";
import { GoalService } from "../../../../use-cases/goals/goalService.js";
import {
	type CreateGoalRequest,
	CreateGoalRequestSchema,
	type PlanGoalRequest,
	PlanGoalRequestSchema,
} from "./schemas.js";

export const goalsRoutes = new Hono<ServerEnv>()
	.get("/", async (c) => {
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.listGoals();
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.post("/", effectValidator("json", CreateGoalRequestSchema), async (c) => {
		const body = c.req.valid("json") as CreateGoalRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.create(body);
				}),
			);
			return c.json(result, 201);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.get("/:id", async (c) => {
		const goalId = c.req.param("id");
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.get(goalId);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.post("/:id/plan", effectValidator("json", PlanGoalRequestSchema), async (c) => {
		const goalId = c.req.param("id");
		const body = c.req.valid("json") as PlanGoalRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.plan(goalId, body);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	});

const toProblem = (error: unknown) => {
	if (error instanceof GoalNotFoundError) {
		return notFound({ detail: `Goal ${error.goalId} not found.` });
	}
	if (error instanceof GoalPlanningError) {
		return badRequest({ detail: "Unable to process goal request." });
	}
	return null;
};
