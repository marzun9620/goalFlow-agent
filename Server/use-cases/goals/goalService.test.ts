import { Decimal } from "@prisma/client/runtime/library";
import { Effect, Layer } from "effect";
import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import type { GoalView } from "../../domain/goals/types.js";
import { GoalNotFoundError } from "./errors.js";
import { type CreateGoalInput, GoalService, GoalServiceLive } from "./goalService.js";
import type { AssignmentRecord, GoalRecord, GoalRepository } from "./repository.js";
import { GoalRepository as GoalRepositoryTag } from "./repository.js";

const makeGoal = (overrides: Partial<GoalRecord> = {}): GoalRecord => ({
	id: "goal-1",
	title: "Ship MVP",
	ownerId: null,
	targetDate: null,
	status: null,
	milestones: null,
	createdAt: new Date("2026-02-01T00:00:00Z"),
	updatedAt: new Date("2026-02-01T00:00:00Z"),
	...overrides,
});

const mockRepo = (impl: Partial<GoalRepository>): Layer.Layer<GoalRepository> =>
	Layer.succeed(GoalRepositoryTag, {
		createGoal: () => Effect.fail(new Error("createGoal not mocked")),
		getGoal: () => Effect.succeed(null),
		updateMilestones: () => Effect.fail(new Error("updateMilestones not mocked")),
		listAssignments: () => Effect.succeed([]),
		listTasks: () => Effect.succeed([]),
		listGoals: () => Effect.succeed([]),
		...impl,
	} as GoalRepository);

const run = <A, E>(layer: Layer.Layer<GoalRepository>, effect: Effect.Effect<A, E, GoalService>) =>
	Effect.runPromise(
		effect.pipe(Effect.provide(Layer.provideMerge(GoalServiceLive, layer)), Effect.either),
	);

describe("GoalService", () => {
	it("creates a goal", async () => {
		const input: CreateGoalInput = { title: "Create onboarding" };
		const repo = mockRepo({
			createGoal: () => Effect.succeed(makeGoal({ title: input.title })),
		});

		const result = await run(
			repo,
			Effect.gen(function* () {
				const service = yield* GoalService;
				return yield* service.create(input);
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			const value = result.right as GoalView;
			expect(value.title).toBe(input.title);
			expect(value.milestones.length).toBe(0);
		}
	});

	it("fails with GoalNotFoundError when goal is missing", async () => {
		const repo = mockRepo({
			getGoal: () => Effect.succeed(null),
		});

		const result = await run(
			repo,
			Effect.gen(function* () {
				const service = yield* GoalService;
				return yield* service.get("missing");
			}),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(GoalNotFoundError);
		}
	});

	it("plans milestones for a goal", async () => {
		let captured: unknown = null;
		const repo = mockRepo({
			getGoal: () => Effect.succeed(makeGoal()),
			updateMilestones: (_id, milestones) => {
				captured = milestones;
				return Effect.succeed(makeGoal({ milestones }));
			},
		});

		const result = await run(
			repo,
			Effect.gen(function* () {
				const service = yield* GoalService;
				return yield* service.plan("goal-1", { numMilestones: 2 });
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(captured).not.toBeNull();
			expect(Array.isArray(captured)).toBe(true);
			if (Array.isArray(captured)) {
				expect(captured.length).toBe(2);
			}
		}
	});

	it("computes workload summary", async () => {
		const repo = mockRepo({
			listAssignments: () =>
				Effect.succeed([
					{
						id: "assign-1",
						taskId: "task-1",
						personId: "person-1",
						allocatedHours: new Decimal(5),
						status: null,
						createdAt: new Date(),
						person: { id: "person-1", name: "Alice" },
						task: {
							id: "task-1",
							title: "Build feature",
							dueAt: new Date("2026-02-20T00:00:00Z"),
							effortHours: new Decimal(5),
						},
					} satisfies AssignmentRecord,
				]),
			listTasks: () =>
				Effect.succeed([
					{
						id: "task-1",
						title: "Build feature",
						description: null,
						priority: null,
						effortHours: new Decimal(5),
						dueAt: new Date("2026-02-20T00:00:00Z"),
						ownerId: null,
						sensitivityLevel: null,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				]),
			listGoals: () =>
				Effect.succeed([
					makeGoal({
						milestones: [
							{ title: "Step 1", status: "completed", tasks: [] },
							{ title: "Step 2", status: "pending", tasks: [] },
						],
					}),
				]),
		});

		const result = await run(
			repo,
			Effect.gen(function* () {
				const service = yield* GoalService;
				return yield* service.workloadSummary();
			}),
		);

		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right.workloads[0].allocatedHours).toBe(5);
			expect(result.right.upcomingDeadlines.length).toBeGreaterThan(0);
			expect(result.right.goalProgress[0].progress).toBeCloseTo(0.5);
		}
	});
});
