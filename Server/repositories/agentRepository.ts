import type { Prisma, PrismaClient } from "@prisma/client";
import { Effect, Layer } from "effect";
import { Database } from "../runtime/database.js";
import { AgentRepositoryError } from "../use-cases/agent/errors.js";
import { AgentRepository } from "../use-cases/agent/repository.js";

const toError = (operation: string) => (cause: unknown) =>
	new AgentRepositoryError({ operation, cause });

const makeService = (client: PrismaClient) => ({
	createConversation: (input?: { title?: string | null }) =>
		Effect.tryPromise({
			try: () =>
				client.conversation.create({
					data: {
						title: input?.title ?? null,
					},
				}),
			catch: toError("createConversation"),
		}),

	appendMessage: (input: {
		conversationId: string;
		role: "USER" | "ASSISTANT" | "SYSTEM";
		content: string;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.conversationMessage.create({
					data: {
						conversationId: input.conversationId,
						role: input.role,
						content: input.content,
					},
				}),
			catch: toError("appendMessage"),
		}),

	createRun: (input: {
		conversationId: string;
		status?: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
		data: {
			input: unknown;
			proposal: unknown;
		};
	}) =>
		Effect.tryPromise({
			try: () =>
				client.agentRun.create({
					data: {
						conversationId: input.conversationId,
						status: input.status ?? "PROPOSED",
						input: input.data.input as Prisma.InputJsonValue,
						proposal: input.data.proposal as Prisma.InputJsonValue,
					},
				}),
			catch: toError("createRun"),
		}),

	getConversationSnapshot: (conversationId: string) =>
		Effect.tryPromise({
			try: async () => {
				const conversation = await client.conversation.findUnique({
					where: { id: conversationId },
				});
				if (!conversation) return null;

				const [messages, runs, actions] = await Promise.all([
					client.conversationMessage.findMany({
						where: { conversationId },
						orderBy: { createdAt: "asc" },
					}),
					client.agentRun.findMany({
						where: { conversationId },
						orderBy: { createdAt: "desc" },
					}),
					client.agentAction.findMany({
						where: {
							run: {
								conversationId,
							},
						},
						orderBy: { createdAt: "asc" },
					}),
				]);

				return {
					conversation,
					messages,
					runs,
					actions,
				};
			},
			catch: toError("getConversationSnapshot"),
		}),
});

export const AgentRepositoryLive = Layer.effect(
	AgentRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return makeService(db.client);
	}),
);
