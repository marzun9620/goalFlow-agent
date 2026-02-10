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

export type AgentPersonRecord = {
	id: string;
	name: string;
	weeklyCapacityHours: number | null;
	currentLoadHours: number;
	skills: Array<{
		name: string;
		level: string | null;
		years: number | null;
	}>;
};

export type AgentTaskRecord = {
	id: string;
	title: string;
	effortHours: number | null;
};

export type AgentGoalRecord = {
	id: string;
	title: string;
	status: string | null;
};

export type AgentAssignmentRecord = {
	id: string;
	taskId: string;
	personId: string;
	allocatedHours: number | null;
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
	searchPeopleByName: (name: string) => Effect.Effect<AgentPersonRecord[], AgentRepositoryError>;
	getRunById: (runId: string) => Effect.Effect<AgentRunRecord | null, AgentRepositoryError>;
	updateRunStatus: (
		runId: string,
		status: AgentRunRecord["status"],
	) => Effect.Effect<AgentRunRecord, AgentRepositoryError>;
	updateRunData: (
		runId: string,
		data: {
			input?: unknown;
			proposal?: unknown;
		},
	) => Effect.Effect<AgentRunRecord, AgentRepositoryError>;
	createAction: (input: {
		runId: string;
		type: string;
		status?: AgentActionRecord["status"];
		payload?: unknown;
		error?: string | null;
	}) => Effect.Effect<AgentActionRecord, AgentRepositoryError>;
	updateAction: (input: {
		actionId: string;
		status: AgentActionRecord["status"];
		payload?: unknown;
		error?: string | null;
	}) => Effect.Effect<AgentActionRecord, AgentRepositoryError>;
	upsertGoalByTitle: (input: {
		title: string;
		status?: string | null;
	}) => Effect.Effect<AgentGoalRecord, AgentRepositoryError>;
	upsertPerson: (input: {
		personId?: string | null;
		name: string;
		weeklyCapacityHours?: number | null;
	}) => Effect.Effect<AgentPersonRecord, AgentRepositoryError>;
	upsertMemberSkill: (input: {
		personId: string;
		skillName: string;
		level?: string | null;
		years?: number | null;
	}) => Effect.Effect<void, AgentRepositoryError>;
	createTask: (input: {
		title: string;
		effortHours?: number | null;
	}) => Effect.Effect<AgentTaskRecord, AgentRepositoryError>;
	createTaskAssignment: (input: {
		taskId: string;
		personId: string;
		allocatedHours?: number | null;
	}) => Effect.Effect<AgentAssignmentRecord, AgentRepositoryError>;
	incrementPersonLoad: (input: {
		personId: string;
		hours: number;
	}) => Effect.Effect<void, AgentRepositoryError>;
	getActionsByRunId: (runId: string) => Effect.Effect<AgentActionRecord[], AgentRepositoryError>;
}

export const AgentRepository = Context.GenericTag<AgentRepository>("AgentRepository");
