import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import { GoalService } from "../../../../use-cases/goals/goalService.js";

export const peopleRoutes = new Hono<ServerEnv>()
	.get("/", async (c) => {
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					return yield* service.listPeople();
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			return respond(c, internalServerError("Unexpected error"));
		}
	})
	.get("/:id", async (c) => {
		const personId = c.req.param("id");
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* GoalService;
					const people = yield* service.listPeople();
					return people.find((p) => p.id === personId) ?? null;
				}),
			);
			if (!result) {
				return respond(c, notFound({ detail: `Person ${personId} not found.` }));
			}
			return c.json(result, 200);
		} catch (error) {
			return respond(c, internalServerError("Unexpected error"));
		}
	});
