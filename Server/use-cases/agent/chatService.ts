import { Context, Effect, Layer } from "effect";
import type { AgentChatResult, AgentProposal } from "../../domain/agent/types.js";
import {
	AgentChatError,
	AgentConversationNotFoundError,
	type AgentRepositoryError,
} from "./errors.js";
import { AgentRepository } from "./repository.js";

export interface AgentChatInput {
	conversationId?: string;
	message: string;
}

export interface AgentConversationView {
	conversation: {
		id: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	};
	messages: Array<{
		id: string;
		role: "user" | "assistant" | "system";
		content: string;
		createdAt: string;
	}>;
	runs: Array<{
		id: string;
		status: "proposed" | "approved" | "rejected" | "executed" | "failed";
		input: unknown;
		proposal: unknown;
		createdAt: string;
		updatedAt: string;
		actions: Array<{
			id: string;
			type: string;
			status: "pending" | "success" | "failed" | "skipped";
			payload: unknown;
			error: string | null;
			createdAt: string;
		}>;
	}>;
}

export interface AgentChatService {
	chat: (
		input: AgentChatInput,
	) => Effect.Effect<
		AgentChatResult,
		AgentConversationNotFoundError | AgentChatError | AgentRepositoryError
	>;
	getConversation: (
		conversationId: string,
	) => Effect.Effect<
		AgentConversationView,
		AgentConversationNotFoundError | AgentChatError | AgentRepositoryError
	>;
}

export const AgentChatService = Context.GenericTag<AgentChatService>("AgentChatService");

const toRole = (role: "USER" | "ASSISTANT" | "SYSTEM"): "user" | "assistant" | "system" => {
	switch (role) {
		case "ASSISTANT":
			return "assistant";
		case "SYSTEM":
			return "system";
		default:
			return "user";
	}
};

const toRunStatus = (
	status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED",
): "proposed" | "approved" | "rejected" | "executed" | "failed" => status.toLowerCase() as never;

const toActionStatus = (
	status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED",
): "pending" | "success" | "failed" | "skipped" => status.toLowerCase() as never;

const makeProposal = (message: string): AgentProposal => ({
	mode: "proposal_only",
	rawMessage: message,
	summary:
		"Proposal captured. This run is saved in proposal-only mode and requires approval to execute.",
	generatedAt: new Date().toISOString(),
	actions: [
		{
			type: "parse_request",
			description: "Parse project, tasks, members, and skill hints from chat.",
		},
		{ type: "prepare_distribution", description: "Prepare a capacity-based assignment preview." },
	],
});

const makeTitle = (message: string) => {
	const cleaned = message.trim().replace(/\s+/g, " ");
	return cleaned.slice(0, 80) || "Agent conversation";
};

const makeService = (repo: AgentRepository): AgentChatService => ({
	chat: (input) =>
		Effect.gen(function* () {
			const conversation = input.conversationId
				? yield* repo.getConversationSnapshot(input.conversationId).pipe(
						Effect.flatMap((snapshot) =>
							snapshot
								? Effect.succeed(snapshot.conversation)
								: Effect.fail(
										new AgentConversationNotFoundError({
											conversationId: input.conversationId as string,
										}),
									),
						),
					)
				: yield* repo.createConversation({ title: makeTitle(input.message) });

			yield* repo.appendMessage({
				conversationId: conversation.id,
				role: "USER",
				content: input.message,
			});

			const proposal = makeProposal(input.message);
			const run = yield* repo.createRun({
				conversationId: conversation.id,
				status: "PROPOSED",
				data: {
					input: { message: input.message },
					proposal,
				},
			});

			yield* repo.appendMessage({
				conversationId: conversation.id,
				role: "ASSISTANT",
				content: proposal.summary,
			});

			return {
				conversationId: conversation.id,
				runId: run.id,
				proposal,
			};
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof AgentConversationNotFoundError || cause._tag === "AgentRepositoryError"
					? cause
					: new AgentChatError({ reason: "Unable to create chat proposal.", cause }),
			),
		),

	getConversation: (conversationId) =>
		Effect.gen(function* () {
			const snapshot = yield* repo.getConversationSnapshot(conversationId);
			if (!snapshot) {
				return yield* Effect.fail(new AgentConversationNotFoundError({ conversationId }));
			}

			const actionsByRunId = new Map<string, AgentConversationView["runs"][number]["actions"]>();
			for (const action of snapshot.actions) {
				const current = actionsByRunId.get(action.runId) ?? [];
				current.push({
					id: action.id,
					type: action.type,
					status: toActionStatus(action.status),
					payload: action.payload,
					error: action.error,
					createdAt: action.createdAt.toISOString(),
				});
				actionsByRunId.set(action.runId, current);
			}

			return {
				conversation: {
					id: snapshot.conversation.id,
					title: snapshot.conversation.title,
					createdAt: snapshot.conversation.createdAt.toISOString(),
					updatedAt: snapshot.conversation.updatedAt.toISOString(),
				},
				messages: snapshot.messages.map((message) => ({
					id: message.id,
					role: toRole(message.role),
					content: message.content,
					createdAt: message.createdAt.toISOString(),
				})),
				runs: snapshot.runs.map((run) => ({
					id: run.id,
					status: toRunStatus(run.status),
					input: run.input,
					proposal: run.proposal,
					createdAt: run.createdAt.toISOString(),
					updatedAt: run.updatedAt.toISOString(),
					actions: actionsByRunId.get(run.id) ?? [],
				})),
			};
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof AgentConversationNotFoundError || cause._tag === "AgentRepositoryError"
					? cause
					: new AgentChatError({ reason: "Unable to read conversation.", cause }),
			),
		),
});

export const AgentChatServiceLive = Layer.effect(
	AgentChatService,
	Effect.gen(function* () {
		const repo = yield* AgentRepository;
		return makeService(repo);
	}),
);
