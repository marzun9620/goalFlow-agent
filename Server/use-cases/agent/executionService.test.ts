import { Effect, Layer } from "effect";
import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import { NoSuitableCandidateError } from "../../domain/matching/errors.js";
import { MatchEmployeeUseCase } from "../matching/matchEmployeeUseCase.js";
import { AgentRunConflictError, AgentRunValidationError } from "./errors.js";
import { AgentExecutionService, AgentExecutionServiceLive } from "./executionService.js";
import type {
	AgentActionRecord,
	AgentAssignmentRecord,
	AgentGoalRecord,
	AgentPersonRecord,
	AgentRepository,
	AgentRunRecord,
	AgentTaskRecord,
} from "./repository.js";
import { AgentRepository as AgentRepositoryTag } from "./repository.js";

const proposedRun = (overrides?: Partial<AgentRunRecord>): AgentRunRecord => ({
	id: "run-1",
	conversationId: "conversation-1",
	status: "PROPOSED",
	input: { message: "test" },
	proposal: {
		mode: "proposal_only",
		intent: {
			project: { mode: "create", name: "Project X" },
			tasks: ["Task A", "Task B"],
			members: [
				{
					name: "Sam",
					resolution: "existing",
					existingPersonId: "person-sam",
					candidateMatches: [],
					weeklyCapacityHours: 40,
					skills: [{ name: "TypeScript", level: "senior", years: 5 }],
				},
			],
			distributionMode: "capacity",
			followUps: [],
		},
	},
	createdAt: new Date("2026-02-09T00:00:00.000Z"),
	updatedAt: new Date("2026-02-09T00:00:00.000Z"),
	...overrides,
});

const mkAction = (
	id: string,
	runId: string,
	type: string,
	status: AgentActionRecord["status"],
): AgentActionRecord => ({
	id,
	runId,
	type,
	status,
	payload: null,
	error: null,
	createdAt: new Date("2026-02-09T00:00:00.000Z"),
});

const buildRepoLayer = (run: AgentRunRecord, options?: { replayActions?: AgentActionRecord[] }) => {
	const state = {
		run,
		actions: options?.replayActions ?? ([] as AgentActionRecord[]),
		taskCounter: 0,
		actionCounter: options?.replayActions?.length ?? 0,
	};

	const repo: AgentRepository = {
		createConversation: () => Effect.die("not used"),
		appendMessage: (input) =>
			Effect.succeed({
				id: "msg-1",
				conversationId: input.conversationId,
				role: input.role,
				content: input.content,
				createdAt: new Date("2026-02-09T00:00:00.000Z"),
			}),
		createRun: () => Effect.die("not used"),
		getConversationSnapshot: () => Effect.succeed(null),
		searchPeopleByName: () => Effect.succeed([]),
		getRunById: () => Effect.succeed(state.run),
		updateRunStatus: (_runId, status) => {
			state.run = { ...state.run, status };
			return Effect.succeed(state.run);
		},
		updateRunData: (_runId, data) => {
			state.run = {
				...state.run,
				...(data.input !== undefined ? { input: data.input } : {}),
				...(data.proposal !== undefined ? { proposal: data.proposal } : {}),
			};
			return Effect.succeed(state.run);
		},
		createAction: (input) => {
			const id = `action-${++state.actionCounter}`;
			const action = mkAction(id, input.runId, input.type, input.status ?? "PENDING");
			action.payload = input.payload ?? null;
			action.error = input.error ?? null;
			state.actions.push(action);
			return Effect.succeed(action);
		},
		updateAction: (input) => {
			const index = state.actions.findIndex((action) => action.id === input.actionId);
			if (index >= 0) {
				state.actions[index] = {
					...state.actions[index],
					status: input.status,
					payload: input.payload ?? state.actions[index].payload,
					error: input.error ?? state.actions[index].error,
				};
				return Effect.succeed(state.actions[index]);
			}
			return Effect.die(`missing action ${input.actionId}`);
		},
		upsertGoalByTitle: (input) =>
			Effect.succeed({
				id: "goal-1",
				title: input.title,
				status: input.status ?? "in_progress",
			} satisfies AgentGoalRecord),
		upsertPerson: (input) =>
			Effect.succeed({
				id: input.personId ?? "person-sam",
				name: input.name,
				weeklyCapacityHours: input.weeklyCapacityHours ?? 40,
				currentLoadHours: 0,
				skills: [],
			} satisfies AgentPersonRecord),
		upsertMemberSkill: () => Effect.void,
		createTask: (input) => {
			const task = {
				id: `task-${++state.taskCounter}`,
				title: input.title,
				effortHours: input.effortHours ?? 8,
			} satisfies AgentTaskRecord;
			return Effect.succeed(task);
		},
		createTaskAssignment: (input) =>
			Effect.succeed({
				id: `assign-${input.taskId}`,
				taskId: input.taskId,
				personId: input.personId,
				allocatedHours: input.allocatedHours ?? null,
			} satisfies AgentAssignmentRecord),
		incrementPersonLoad: () => Effect.void,
		getActionsByRunId: () => Effect.succeed(state.actions),
	};

	return Layer.succeed(AgentRepositoryTag, repo);
};

const matchingLayer = Layer.succeed(MatchEmployeeUseCase, {
	match: (taskId: string) =>
		taskId === "missing-task"
			? Effect.fail(new NoSuitableCandidateError({ taskId }))
			: Effect.succeed({
					taskId,
					candidates: [
						{
							personId: "person-sam",
							personName: "Sam",
							skillMatches: [],
							skillScore: 0,
							capacityScore: 1,
							overallScore: 1,
						},
					],
					bestMatch: {
						personId: "person-sam",
						personName: "Sam",
						skillMatches: [],
						skillScore: 0,
						capacityScore: 1,
						overallScore: 1,
					},
					justification: "ok",
					computedAt: new Date().toISOString(),
				}),
});

const runApprove = (
	run: AgentRunRecord,
	idempotencyKey: string,
	replayActions?: AgentActionRecord[],
) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const service = yield* AgentExecutionService;
			return yield* service.approve(run.id, { idempotencyKey });
		}).pipe(
			Effect.provide(
				Layer.provideMerge(
					AgentExecutionServiceLive,
					Layer.merge(buildRepoLayer(run, { replayActions }), matchingLayer),
				),
			),
			Effect.either,
		),
	);

describe("AgentExecutionService", () => {
	it("executes approved run and records assignments", async () => {
		const result = await runApprove(proposedRun(), "idem-1");
		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.status).toBe("executed");
			expect(result.right.replayed).toBe(false);
			expect(result.right.tasks).toHaveLength(2);
			expect(result.right.assignments).toHaveLength(2);
			expect(
				result.right.actions.some((action) => action.type === "assign_tasks_by_capacity"),
			).toBe(true);
		}
	});

	it("returns replayed result when run already executed with same idempotency key", async () => {
		const replayRun = proposedRun({
			status: "EXECUTED",
			input: { approval: { idempotencyKey: "idem-replay" } },
		});
		const replayActions = [
			mkAction("action-1", replayRun.id, "assign_tasks_by_capacity", "SUCCESS"),
		];

		const result = await runApprove(replayRun, "idem-replay", replayActions);
		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.replayed).toBe(true);
			expect(result.right.actions).toHaveLength(1);
		}
	});

	it("fails validation when proposal has unresolved follow-ups", async () => {
		const invalidRun = proposedRun({
			proposal: {
				mode: "proposal_only",
				intent: {
					project: { mode: "create", name: "Project X" },
					tasks: ["Task A"],
					members: [
						{
							name: "Sam",
							resolution: "existing",
							existingPersonId: "person-sam",
							candidateMatches: [],
							weeklyCapacityHours: 40,
							skills: [{ name: "TypeScript", level: "senior", years: 5 }],
						},
					],
					distributionMode: "capacity",
					followUps: ["Need capacity"],
				},
			},
		});
		const result = await runApprove(invalidRun, "idem-2");
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(AgentRunValidationError);
		}
	});

	it("fails conflict when run already executed with different idempotency key", async () => {
		const executedRun = proposedRun({
			status: "EXECUTED",
			input: { approval: { idempotencyKey: "idem-original" } },
		});
		const result = await runApprove(executedRun, "idem-new");
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(AgentRunConflictError);
		}
	});
});
