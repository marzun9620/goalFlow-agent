import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	badRequest,
	internalServerError,
	respond,
} from "../../../../runtime/types.js";
import { ConnectorsService } from "../../../../use-cases/connectors/connectorsService.js";
import { ConnectorError } from "../../../../use-cases/connectors/errors.js";
import {
	type CalendarSyncRequest,
	CalendarSyncRequestSchema,
	type NotificationRequest,
	NotificationRequestSchema,
	type ProjectSyncRequest,
	ProjectSyncRequestSchema,
} from "./schemas.js";

export const connectorsRoutes = new Hono<ServerEnv>()
	.post("/calendar/sync", effectValidator("json", CalendarSyncRequestSchema), async (c) => {
		const body = c.req.valid("json") as CalendarSyncRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ConnectorsService;
					return yield* service.syncCalendar(
						body.personId,
						new Date(body.start),
						new Date(body.end),
					);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.post("/messaging/notify", effectValidator("json", NotificationRequestSchema), async (c) => {
		const body = c.req.valid("json") as NotificationRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ConnectorsService;
					return yield* service.sendNotification(body);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.post("/project/sync", effectValidator("json", ProjectSyncRequestSchema), async (c) => {
		const body = c.req.valid("json") as ProjectSyncRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ConnectorsService;
					return yield* service.syncProjectTask(body.taskId, body.provider);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	});

const toProblem = (error: unknown) => {
	if (error instanceof ConnectorError) {
		return badRequest({ detail: `Connector error: ${error.provider}` });
	}
	return null;
};
