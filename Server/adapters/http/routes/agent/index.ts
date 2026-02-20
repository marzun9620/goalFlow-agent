import { effectValidator } from "@hono/effect-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import {
	type ServerEnv,
	badRequest,
	conflict,
	internalServerError,
	notFound,
	respond,
} from "../../../../runtime/types.js";
import { AgentChatService } from "../../../../use-cases/agent/chatService.js";
import {
	AgentChatError,
	AgentConversationNotFoundError,
	AgentRunConflictError,
	AgentRunNotFoundError,
	AgentRunValidationError,
} from "../../../../use-cases/agent/errors.js";
import { AgentExecutionService } from "../../../../use-cases/agent/executionService.js";
import {
	type AgentApproveRequest,
	AgentApproveRequestSchema,
	type AgentChatRequest,
	AgentChatRequestSchema,
} from "./schemas.js";

export const agentRoutes = new Hono<ServerEnv>()
	.post("/chat", effectValidator("json", AgentChatRequestSchema), async (c) => {
		const body = c.req.valid("json") as AgentChatRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* AgentChatService;
					return yield* service.chat(body);
				}),
			);
			return c.json(result, 201);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.get("/conversations/:id", async (c) => {
		const conversationId = c.req.param("id");
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* AgentChatService;
					return yield* service.getConversation(conversationId);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	})
	.post("/approve/:runId", effectValidator("json", AgentApproveRequestSchema), async (c) => {
		const runId = c.req.param("runId");
		const body = c.req.valid("json") as AgentApproveRequest;
		try {
			const result = await c.var.run(
				Effect.gen(function* () {
					const service = yield* AgentExecutionService;
					return yield* service.approve(runId, body);
				}),
			);
			return c.json(result, 200);
		} catch (error) {
			const problem = toProblem(error) ?? internalServerError("Unexpected error");
			return respond(c, problem);
		}
	});

const toProblem = (error: unknown) => {
	if (error instanceof AgentConversationNotFoundError) {
		return notFound({ detail: `Conversation ${error.conversationId} not found.` });
	}
	if (error instanceof AgentRunNotFoundError) {
		return notFound({ detail: `Run ${error.runId} not found.` });
	}
	if (error instanceof AgentRunConflictError) {
		return conflict({ detail: error.reason });
	}
	if (error instanceof AgentRunValidationError) {
		return badRequest({ detail: error.reason });
	}
	if (error instanceof AgentChatError) {
		return badRequest({ detail: error.reason });
	}
	return null;
};
