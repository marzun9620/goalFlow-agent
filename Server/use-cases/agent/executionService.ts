import { Context, Effect, Layer } from "effect";
import { NoSuitableCandidateError, TaskNotFoundError } from "../../domain/matching/errors.js";
import { MatchingFlowError } from "../matching/errors.js";
import { MatchEmployeeUseCase } from "../matching/matchEmployeeUseCase.js";
import {
	AgentChatError,
	type AgentRepositoryError,
	AgentRunConflictError,
	AgentRunNotFoundError,
	AgentRunValidationError,
} from "./errors.js";
import { AgentRepository, type AgentTaskRecord } from "./repository.js";

type ActionStatus = "pending" | "success" | "failed" | "skipped";

export interface AgentApproveInput {
	idempotencyKey: string;
}

export interface AgentApproveResult {
	runId: string;
	status: "executed";
	idempotencyKey: string;
	replayed: boolean;
	goalId: string | null;
	members: Array<{ id: string; name: string }>;
	tasks: Array<{ id: string; title: string }>;
	assignments: Array<{ taskId: string; personId: string; allocatedHours: number | null }>;
	actions: Array<{
		id: string;
		type: string;
		status: ActionStatus;
		error: string | null;
		createdAt: string;
		payload: unknown;
	}>;
}

export interface AgentExecutionService {
	approve: (
		runId: string,
		input: AgentApproveInput,
	) => Effect.Effect<
		AgentApproveResult,
		| AgentRunNotFoundError
		| AgentRunConflictError
		| AgentRunValidationError
		| AgentChatError
		| AgentRepositoryError
	>;
}

export const AgentExecutionService =
	Context.GenericTag<AgentExecutionService>("AgentExecutionService");

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown, path: string[]): string | null => {
	let cursor: unknown = value;
	for (const key of path) {
		if (!isRecord(cursor)) return null;
		cursor = cursor[key];
	}
	return typeof cursor === "string" ? cursor : null;
};

const approvalKeyFromRunInput = (input: unknown) =>
	readString(input, ["approval", "idempotencyKey"]);

const mergeApprovalMeta = (input: unknown, idempotencyKey: string) => {
	const nowIso = new Date().toISOString();
	const base = isRecord(input) ? input : {};
	const approval = isRecord(base.approval) ? base.approval : {};
	return {
		...base,
		approval: {
			...approval,
			idempotencyKey,
			approvedAt: nowIso,
		},
	};
};

type ParsedIntent = {
	project: { name: string } | null;
	tasks: string[];
	members: Array<{
		name: string;
		resolution: "existing" | "new" | "ambiguous";
		existingPersonId: string | null;
		weeklyCapacityHours: number | null;
		skills: Array<{ name: string; level: string | null; years: number | null }>;
	}>;
	distributionMode: "capacity";
	followUps: string[];
};

type AgentExecutionError =
	| AgentRunNotFoundError
	| AgentRunConflictError
	| AgentRunValidationError
	| AgentChatError
	| AgentRepositoryError;

type ParsedMember = ParsedIntent["members"][number];

const isAgentRepositoryError = (cause: unknown): cause is AgentRepositoryError =>
	cause instanceof Error && "_tag" in cause && cause._tag === "AgentRepositoryError";

const parseIntentFromRun = (runId: string, proposal: unknown): ParsedIntent => {
	if (!isRecord(proposal)) {
		throw new AgentRunValidationError({ runId, reason: "Run proposal payload is not an object." });
	}
	const intentRaw = proposal.intent;
	if (!isRecord(intentRaw)) {
		throw new AgentRunValidationError({ runId, reason: "Run proposal missing parsed intent." });
	}

	const followUpsRaw = Array.isArray(intentRaw.followUps) ? intentRaw.followUps : [];
	const followUps = followUpsRaw.filter((item): item is string => typeof item === "string");
	if (followUps.length > 0) {
		throw new AgentRunValidationError({
			runId,
			reason: `Proposal has unresolved clarifications: ${followUps.join(" | ")}`,
		});
	}

	const distributionMode = intentRaw.distributionMode;
	if (distributionMode !== "capacity") {
		throw new AgentRunValidationError({
			runId,
			reason: "Only capacity-based distribution is supported for approval execution.",
		});
	}

	const tasksRaw = Array.isArray(intentRaw.tasks) ? intentRaw.tasks : [];
	const tasks = tasksRaw
		.filter((task): task is string => typeof task === "string")
		.map((task) => task.trim())
		.filter(Boolean);
	if (tasks.length === 0) {
		throw new AgentRunValidationError({ runId, reason: "Proposal has no tasks to execute." });
	}

	const membersRaw = Array.isArray(intentRaw.members) ? intentRaw.members : [];
	const members = membersRaw
		.filter((member): member is Record<string, unknown> => isRecord(member))
		.map((member): ParsedMember => {
			const resolution: ParsedMember["resolution"] =
				member.resolution === "existing" ||
				member.resolution === "new" ||
				member.resolution === "ambiguous"
					? member.resolution
					: "new";

			return {
				name: typeof member.name === "string" ? member.name.trim() : "",
				resolution,
				existingPersonId:
					typeof member.existingPersonId === "string" ? member.existingPersonId : null,
				weeklyCapacityHours:
					typeof member.weeklyCapacityHours === "number" ? member.weeklyCapacityHours : null,
				skills: Array.isArray(member.skills)
					? member.skills
							.filter((skill): skill is Record<string, unknown> => isRecord(skill))
							.map((skill) => ({
								name: typeof skill.name === "string" ? skill.name.trim() : "",
								level: typeof skill.level === "string" ? skill.level : null,
								years: typeof skill.years === "number" ? skill.years : null,
							}))
							.filter((skill) => Boolean(skill.name))
					: [],
			};
		})
		.filter((member) => Boolean(member.name));

	if (members.length === 0) {
		throw new AgentRunValidationError({ runId, reason: "Proposal has no members to assign." });
	}
	for (const member of members) {
		if (member.resolution === "ambiguous") {
			throw new AgentRunValidationError({
				runId,
				reason: `Member "${member.name}" is ambiguous and must be clarified before approval.`,
			});
		}
		for (const skill of member.skills) {
			if (!skill.level) {
				throw new AgentRunValidationError({
					runId,
					reason: `Skill "${skill.name}" for member "${member.name}" is missing level.`,
				});
			}
		}
	}

	const projectRaw = isRecord(intentRaw.project) ? intentRaw.project : null;
	const project =
		projectRaw && typeof projectRaw.name === "string" && projectRaw.name.trim()
			? { name: projectRaw.name.trim() }
			: null;

	return {
		project,
		tasks,
		members,
		distributionMode: "capacity",
		followUps: [],
	};
};

const toMessage = (cause: unknown): string => {
	if (cause instanceof Error && cause.message) return cause.message;
	try {
		return JSON.stringify(cause);
	} catch {
		return String(cause);
	}
};

const toActionStatus = (
	status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED",
): "pending" | "success" | "failed" | "skipped" => status.toLowerCase() as ActionStatus;

const withAction = <A, E>(
	repo: AgentRepository,
	runId: string,
	type: string,
	payload: unknown,
	effect: Effect.Effect<A, E>,
): Effect.Effect<A, E | AgentRepositoryError> =>
	Effect.gen(function* () {
		const action = yield* repo.createAction({
			runId,
			type,
			status: "PENDING",
			payload,
		});

		return yield* effect.pipe(
			Effect.tap((result) =>
				repo.updateAction({
					actionId: action.id,
					status: "SUCCESS",
					payload: {
						request: payload,
						result,
					},
				}),
			),
			Effect.catchAll((cause) =>
				repo
					.updateAction({
						actionId: action.id,
						status: "FAILED",
						payload,
						error: toMessage(cause),
					})
					.pipe(Effect.flatMap(() => Effect.fail(cause))),
			),
		);
	});

const createService = (
	repo: AgentRepository,
	matching: MatchEmployeeUseCase,
): AgentExecutionService => ({
	approve: (runId, input) =>
		Effect.gen(function* () {
			if (!input.idempotencyKey.trim()) {
				return yield* Effect.fail(
					new AgentRunValidationError({ runId, reason: "idempotencyKey is required." }),
				);
			}

			const run = yield* repo.getRunById(runId);
			if (!run) {
				return yield* Effect.fail(new AgentRunNotFoundError({ runId }));
			}

			const previousKey = approvalKeyFromRunInput(run.input);
			if (run.status === "EXECUTED" && previousKey === input.idempotencyKey) {
				const actions = yield* repo.getActionsByRunId(runId);
				return {
					runId,
					status: "executed",
					idempotencyKey: input.idempotencyKey,
					replayed: true,
					goalId: null,
					members: [],
					tasks: [],
					assignments: [],
					actions: actions.map((action) => ({
						id: action.id,
						type: action.type,
						status: toActionStatus(action.status),
						error: action.error,
						createdAt: action.createdAt.toISOString(),
						payload: action.payload,
					})),
				} satisfies AgentApproveResult;
			}

			if (run.status !== "PROPOSED") {
				return yield* Effect.fail(
					new AgentRunConflictError({
						runId,
						reason: `Run is already ${run.status.toLowerCase()} and cannot be approved again.`,
					}),
				);
			}

			const parsed = yield* Effect.try({
				try: () => parseIntentFromRun(runId, run.proposal),
				catch: (cause) =>
					cause instanceof AgentRunValidationError
						? cause
						: new AgentChatError({
								reason: "Failed to parse proposal intent for execution.",
								cause,
							}),
			});

			yield* repo.updateRunData(runId, {
				input: mergeApprovalMeta(run.input, input.idempotencyKey),
			});
			yield* repo.updateRunStatus(runId, "APPROVED");

			const execution = yield* Effect.gen(function* () {
				let goalId: string | null = null;

				if (parsed.project) {
					const goal = yield* withAction(
						repo,
						runId,
						"upsert_goal",
						{ title: parsed.project.name },
						repo.upsertGoalByTitle({
							title: parsed.project.name,
							status: "in_progress",
						}),
					);
					goalId = goal.id;
				}

				const members = yield* withAction(
					repo,
					runId,
					"upsert_members",
					{ count: parsed.members.length },
					Effect.forEach(parsed.members, (member) =>
						repo.upsertPerson({
							personId: member.resolution === "existing" ? member.existingPersonId : null,
							name: member.name,
							weeklyCapacityHours: member.weeklyCapacityHours,
						}),
					),
				);

				const memberByName = new Map(
					members.map((member) => [member.name.toLowerCase(), member.id]),
				);

				const resolvedMembers: Array<ParsedMember & { personId: string }> = [];
				for (const member of parsed.members) {
					const personId = memberByName.get(member.name.toLowerCase());
					if (!personId) {
						return yield* Effect.fail(
							new AgentRunValidationError({
								runId,
								reason: `Cannot upsert skills; member ${member.name} was not created.`,
							}),
						);
					}
					resolvedMembers.push({
						...member,
						personId,
					});
				}

				yield* withAction(
					repo,
					runId,
					"upsert_member_skills",
					{ count: parsed.members.reduce((sum, m) => sum + m.skills.length, 0) },
					Effect.all(
						resolvedMembers.map((member) =>
							Effect.forEach(member.skills, (skill) =>
								repo.upsertMemberSkill({
									personId: member.personId,
									skillName: skill.name,
									level: skill.level,
									years: skill.years,
								}),
							).pipe(Effect.asVoid),
						),
						{ discard: true },
					),
				);

				const tasks = yield* withAction(
					repo,
					runId,
					"create_tasks",
					{ count: parsed.tasks.length },
					Effect.forEach(parsed.tasks, (taskTitle) =>
						repo.createTask({
							title: taskTitle,
							effortHours: 8,
						}),
					),
				);

				const memberIds = members.map((member) => member.id);
				const assignments = yield* withAction(
					repo,
					runId,
					"assign_tasks_by_capacity",
					{ taskCount: tasks.length, memberCount: memberIds.length },
					Effect.forEach(tasks, (task: AgentTaskRecord) =>
						Effect.gen(function* () {
							const match = yield* matching.match(task.id, {
								limit: 1,
								skillWeight: 0,
								capacityWeight: 1,
								includePersonIds: memberIds,
							});

							const best = match.bestMatch;
							if (!best) {
								return yield* Effect.fail(new NoSuitableCandidateError({ taskId: task.id }));
							}

							const allocatedHours = task.effortHours ?? 8;
							const assignment = yield* repo.createTaskAssignment({
								taskId: task.id,
								personId: best.personId,
								allocatedHours,
							});
							yield* repo.incrementPersonLoad({
								personId: best.personId,
								hours: allocatedHours,
							});
							return {
								taskId: assignment.taskId,
								personId: assignment.personId,
								allocatedHours: assignment.allocatedHours,
							};
						}),
					),
				);

				return {
					goalId,
					members: members.map((member) => ({ id: member.id, name: member.name })),
					tasks: tasks.map((task) => ({ id: task.id, title: task.title })),
					assignments,
				};
			}).pipe(Effect.tapError(() => repo.updateRunStatus(runId, "FAILED")));

			yield* repo.updateRunStatus(runId, "EXECUTED");
			yield* repo.appendMessage({
				conversationId: run.conversationId,
				role: "ASSISTANT",
				content: `Approved run ${runId} executed successfully.`,
			});

			const actions = yield* repo.getActionsByRunId(runId);
			return {
				runId,
				status: "executed",
				idempotencyKey: input.idempotencyKey,
				replayed: false,
				goalId: execution.goalId,
				members: execution.members,
				tasks: execution.tasks,
				assignments: execution.assignments,
				actions: actions.map((action) => ({
					id: action.id,
					type: action.type,
					status: toActionStatus(action.status),
					error: action.error,
					createdAt: action.createdAt.toISOString(),
					payload: action.payload,
				})),
			} satisfies AgentApproveResult;
		}).pipe(
			Effect.mapError((cause): AgentExecutionError => {
				if (
					cause instanceof AgentRunNotFoundError ||
					cause instanceof AgentRunConflictError ||
					cause instanceof AgentRunValidationError ||
					cause instanceof AgentChatError ||
					isAgentRepositoryError(cause)
				) {
					return cause;
				}

				if (cause instanceof TaskNotFoundError) {
					return new AgentRunValidationError({
						runId,
						reason: `Generated task ${cause.taskId} cannot be matched.`,
					});
				}
				if (cause instanceof NoSuitableCandidateError) {
					return new AgentRunValidationError({
						runId,
						reason: `No suitable candidate found for generated task ${cause.taskId}.`,
					});
				}
				if (cause instanceof MatchingFlowError) {
					return new AgentChatError({
						reason: `Task distribution failed at ${cause.operation}.`,
						cause,
					});
				}

				return new AgentChatError({
					reason: "Failed to execute approved run.",
					cause,
				});
			}),
		),
});

export const AgentExecutionServiceLive = Layer.effect(
	AgentExecutionService,
	Effect.gen(function* () {
		const repo = yield* AgentRepository;
		const matching = yield* MatchEmployeeUseCase;
		return createService(repo, matching);
	}),
);
