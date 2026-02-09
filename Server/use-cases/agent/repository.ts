import { Context, type Effect } from "effect";
import type { AgentRepositoryError } from "./errors.js";

export type ConversationRecord = {
	id: string;
	title: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ConversationMessageRecord = {
	id: string;
	conversationId: string;
	role: "USER" | "ASSISTANT" | "SYSTEM";
	content: string;
	createdAt: Date;
};

export type AgentRunRecord = {
	id: string;
	conversationId: string;
	status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
	input: unknown;
	proposal: unknown;
	createdAt: Date;
	updatedAt: Date;
};

export type AgentActionRecord = {
	id: string;
	runId: string;
	type: string;
	status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";
	payload: unknown;
	error: string | null;
	createdAt: Date;
};

export type AgentConversationSnapshot = {
	conversation: ConversationRecord;
	messages: ConversationMessageRecord[];
	runs: AgentRunRecord[];
	actions: AgentActionRecord[];
};

export interface AgentRepository {
	createConversation: (input?: {
		title?: string | null;
	}) => Effect.Effect<ConversationRecord, AgentRepositoryError>;
	appendMessage: (input: {
		conversationId: string;
		role: ConversationMessageRecord["role"];
		content: string;
	}) => Effect.Effect<ConversationMessageRecord, AgentRepositoryError>;
	createRun: (input: {
		conversationId: string;
		status?: AgentRunRecord["status"];
		data: {
			input: unknown;
			proposal: unknown;
		};
	}) => Effect.Effect<AgentRunRecord, AgentRepositoryError>;
	getConversationSnapshot: (
		conversationId: string,
	) => Effect.Effect<AgentConversationSnapshot | null, AgentRepositoryError>;
}

export const AgentRepository = Context.GenericTag<AgentRepository>("AgentRepository");
