import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import { GoalService } from "../../../../use-cases/goals/goalService.js";

export const tasksRoutes = new Hono<ServerEnv>()
	.get("/", async (c) => {
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.listTasks();
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			return respond(c, internalServerError("Unexpected error"));
		}
	})
	.get("/:id", async (c) => {
		const taskId = c.req.param("id");
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					const tasks = yield* service.listTasks();
					return tasks.find((t) => t.id === taskId) ?? null;
				}),
			);
			if (!result) {
				return respond(c, notFound({ detail: `Task ${taskId} not found.` }));
			}
			return c.json(result, 200);
		} catch (error) {
			return respond(c, internalServerError("Unexpected error"));
		}
	});
