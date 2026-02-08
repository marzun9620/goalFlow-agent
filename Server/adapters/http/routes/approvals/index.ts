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
import { ApprovalService } from "../../../../use-cases/approvals/approvalService.js";
import {
	ApprovalAlreadyDecidedError,
	ApprovalNotFoundError,
} from "../../../../use-cases/approvals/errors.js";
import {
	type CreateApprovalRequest,
	CreateApprovalRequestSchema,
	type UpdateApprovalRequest,
	UpdateApprovalRequestSchema,
} from "./schemas.js";

export const approvalsRoutes = new Hono<ServerEnv>()
	.post("/", effectValidator("json", CreateApprovalRequestSchema), async (c) => {
		const body = c.req.valid("json") as CreateApprovalRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ApprovalService;
					return yield* service.create(body);
				}),
			);
			return c.json(result, 201);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.patch("/:id", effectValidator("json", UpdateApprovalRequestSchema), async (c) => {
		const id = c.req.param("id");
		const body = c.req.valid("json") as UpdateApprovalRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ApprovalService;
					return yield* service.updateStatus(id, body.status);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.get("/", async (c) => {
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* ApprovalService;
					return yield* service.list();
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	});

const toProblem = (error: unknown) => {
	if (error instanceof ApprovalNotFoundError) {
		return notFound({ detail: `Approval ${error.id} not found` });
	}
	if (error instanceof ApprovalAlreadyDecidedError) {
		return badRequest({ detail: `Approval already ${error.status}` });
	}
	return null;
};
