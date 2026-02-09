import { Context, Effect, Layer } from "effect";
import type {
	AgentChatResult,
	AgentIntentPayload,
	AgentMemberIntent,
	AgentProposal,
} from "../../domain/agent/types.js";
import {
	AgentChatError,
	AgentConversationNotFoundError,
	type AgentRepositoryError,
} from "./errors.js";
import { parseIntentDraft } from "./intentParser.js";
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

const memberNameEquals = (a: string, b: string) =>
	a.trim().toLowerCase() === b.trim().toLowerCase();

const resolveMemberIntent = (
	memberName: string,
	matches: Array<{ id: string; name: string; weeklyCapacityHours: number | null }>,
): Omit<AgentMemberIntent, "weeklyCapacityHours" | "skills"> => {
	const exactMatches = matches.filter((match) => memberNameEquals(match.name, memberName));
	if (exactMatches.length === 1) {
		return {
			name: memberName,
			resolution: "existing",
			existingPersonId: exactMatches[0].id,
			candidateMatches: [{ id: exactMatches[0].id, name: exactMatches[0].name }],
		};
	}
	if (exactMatches.length > 1 || matches.length > 1) {
		return {
			name: memberName,
			resolution: "ambiguous",
			existingPersonId: null,
			candidateMatches: matches.map((match) => ({ id: match.id, name: match.name })),
		};
	}
	if (matches.length === 1) {
		return {
			name: memberName,
			resolution: "existing",
			existingPersonId: matches[0].id,
			candidateMatches: [{ id: matches[0].id, name: matches[0].name }],
		};
	}
	return {
		name: memberName,
		resolution: "new",
		existingPersonId: null,
		candidateMatches: [],
	};
};

const buildFollowUps = (intent: AgentIntentPayload) => {
	const questions: string[] = [];
	if (!intent.project) {
		questions.push("What is the project name?");
	}
	if (intent.tasks.length === 0) {
		questions.push("Which tasks should be created?");
	}
	for (const member of intent.members) {
		if (member.resolution === "ambiguous" && member.candidateMatches.length > 0) {
			const options = member.candidateMatches.map((candidate) => candidate.name).join(", ");
			questions.push(`Which ${member.name} do you mean: ${options}?`);
		}
		if (member.weeklyCapacityHours == null) {
			questions.push(`What weekly capacity (hours/week) should I use for ${member.name}?`);
		}
		for (const skill of member.skills) {
			if (!skill.level) {
				questions.push(`What level should I record for ${member.name}'s ${skill.name} skill?`);
			}
		}
	}
	return questions;
};

const makeSummary = (intent: AgentIntentPayload) => {
	const memberStats = intent.members.reduce(
		(acc, member) => {
			acc[member.resolution] += 1;
			return acc;
		},
		{ existing: 0, new: 0, ambiguous: 0 },
	);

	const base = `Parsed ${intent.tasks.length} task(s) and ${intent.members.length} member(s) for proposal-only review.`;
	const details = ` Existing: ${memberStats.existing}, New: ${memberStats.new}, Ambiguous: ${memberStats.ambiguous}.`;
	if (intent.followUps.length === 0) {
		return `${base}${details} Ready for approval once you confirm.`;
	}
	return `${base}${details} Need ${intent.followUps.length} clarification(s) before approval.`;
};

const makeProposal = (
	repo: AgentRepository,
	message: string,
): Effect.Effect<AgentProposal, AgentRepositoryError> =>
	Effect.gen(function* () {
		const draft = parseIntentDraft(message);
		const members: AgentIntentPayload["members"] = [];

		for (const draftMember of draft.members) {
			const matches = yield* repo.searchPeopleByName(draftMember.name).pipe(
				Effect.map((results) =>
					results.map((result) => ({
						id: result.id,
						name: result.name,
						weeklyCapacityHours: result.weeklyCapacityHours,
					})),
				),
			);

			const resolved = resolveMemberIntent(draftMember.name, matches);
			const preferredCapacityFromExisting =
				resolved.existingPersonId == null
					? null
					: (matches.find((match) => match.id === resolved.existingPersonId)?.weeklyCapacityHours ??
						null);

			members.push({
				name: resolved.name,
				resolution: resolved.resolution,
				existingPersonId: resolved.existingPersonId,
				candidateMatches: resolved.candidateMatches,
				weeklyCapacityHours: draftMember.weeklyCapacityHours ?? preferredCapacityFromExisting,
				skills: draftMember.skills,
			});
		}

		const intent: AgentIntentPayload = {
			project: draft.project,
			tasks: draft.tasks,
			members,
			distributionMode: draft.distributionMode ?? "capacity",
			followUps: [],
		};
		const followUps = buildFollowUps(intent);
		intent.followUps = followUps;

		const actions: AgentProposal["actions"] = [
			{
				type: "parse_request",
				description: "Parse project, tasks, members, and member skills from chat input.",
			},
			{
				type: "resolve_members",
				description: "Match member names to existing people and flag ambiguous matches.",
			},
			{
				type: "preview_upserts",
				description: "Preview person and skill upserts in proposal-only mode (no writes).",
			},
			{
				type: "prepare_distribution",
				description: "Prepare a capacity-based assignment preview for approval.",
			},
		];

		if (followUps.length > 0) {
			actions.push({
				type: "collect_followups",
				description: "Collect missing weekly capacity and skill level details before execution.",
			});
		}

		return {
			mode: "proposal_only",
			rawMessage: message,
			summary: makeSummary(intent),
			generatedAt: new Date().toISOString(),
			intent,
			actions,
		};
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

			const proposal = yield* makeProposal(repo, input.message);
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
