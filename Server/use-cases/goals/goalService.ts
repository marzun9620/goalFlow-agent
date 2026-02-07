import { Context, Effect, Layer } from "effect";
import type {
	GoalProgress,
	GoalView,
	Milestone,
	PersonWorkload,
	WorkloadSummary,
} from "../../domain/goals/types.js";
import { GoalNotFoundError, GoalPlanningError } from "./errors.js";
import type { AssignmentRecord, GoalRecord, GoalRepository } from "./repository.js";
import { GoalRepository as GoalRepositoryTag } from "./repository.js";

export interface CreateGoalInput {
	title: string;
	ownerId?: string | null;
	targetDate?: string | null;
	status?: string | null;
}

export interface PlanGoalOptions {
	numMilestones?: number;
}

export interface GoalService {
	create: (input: CreateGoalInput) => Effect.Effect<GoalView, GoalPlanningError>;
	get: (goalId: string) => Effect.Effect<GoalView, GoalNotFoundError | GoalPlanningError>;
	plan: (
		goalId: string,
		options?: PlanGoalOptions,
	) => Effect.Effect<GoalView, GoalNotFoundError | GoalPlanningError>;
	workloadSummary: () => Effect.Effect<WorkloadSummary, GoalPlanningError>;
}

export const GoalService = Context.GenericTag<GoalService>("GoalService");

const parseMilestones = (value: unknown): Milestone[] => {
	if (!value || !Array.isArray(value)) return [];

	const parsed: Milestone[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;

		const title = "title" in item && typeof item.title === "string" ? item.title : null;
		if (!title) continue;

		const status =
			"status" in item && typeof item.status === "string"
				? (item.status as Milestone["status"])
				: "pending";

		const tasksValue = "tasks" in item ? (item as { tasks?: unknown }).tasks : undefined;
		const tasks = Array.isArray(tasksValue)
			? tasksValue.filter((t): t is string => typeof t === "string")
			: [];

		const targetDateValue =
			"targetDate" in item ? (item as { targetDate?: unknown }).targetDate : undefined;
		const targetDate = typeof targetDateValue === "string" ? targetDateValue : null;

		parsed.push({ title, status, tasks, targetDate });
	}

	return parsed;
};

const toGoalView = (goal: GoalRecord): GoalView => ({
	id: goal.id,
	title: goal.title,
	ownerId: goal.ownerId ?? null,
	targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString() : null,
	status: goal.status ?? null,
	milestones: parseMilestones(goal.milestones),
	createdAt: goal.createdAt.toISOString(),
	updatedAt: goal.updatedAt.toISOString(),
});

const buildPlan = (goal: GoalRecord, opts?: PlanGoalOptions): Milestone[] => {
	const count = opts?.numMilestones && opts.numMilestones > 0 ? opts.numMilestones : 3;
	const baseTitle = goal.title;
	const start = new Date();
	const end = goal.targetDate ? new Date(goal.targetDate) : null;

	const intervals: (string | null)[] = [];
	if (end) {
		const totalMs = end.getTime() - start.getTime();
		const step = totalMs / count;
		for (let i = 1; i <= count; i++) {
			const date = new Date(start.getTime() + step * i);
			intervals.push(date.toISOString());
		}
	} else {
		for (let i = 0; i < count; i++) intervals.push(null);
	}

	return Array.from({ length: count }).map((_, idx) => ({
		title: `Milestone ${idx + 1}: ${baseTitle}`,
		tasks: [],
		targetDate: intervals[idx],
		status: "pending" as const,
	}));
};

const buildWorkloads = (rawAssignments: AssignmentRecord[]): PersonWorkload[] => {
	const totals = new Map<string, { name: string; hours: number }>();
	for (const item of rawAssignments) {
		const hours = Number(item.allocatedHours ?? item.task.effortHours ?? 0);
		const current = totals.get(item.person.id) ?? { name: item.person.name, hours: 0 };
		current.hours += hours;
		totals.set(item.person.id, current);
	}

	return Array.from(totals.entries()).map(([personId, data]) => ({
		personId,
		personName: data.name,
		allocatedHours: data.hours,
	}));
};

const buildGoalProgress = (goals: GoalRecord[]): GoalProgress[] =>
	goals.map((goal) => {
		const milestones = parseMilestones(goal.milestones);
		if (milestones.length === 0) {
			return { goalId: goal.id, title: goal.title, progress: 0 };
		}
		const completed = milestones.filter((m) => m.status === "completed").length;
		return {
			goalId: goal.id,
			title: goal.title,
			progress: completed / milestones.length,
		};
	});

const makeService = (repo: GoalRepository): GoalService => ({
	create: (input) =>
		repo
			.createGoal({
				title: input.title,
				ownerId: input.ownerId ?? null,
				targetDate: input.targetDate ? new Date(input.targetDate) : null,
				status: input.status ?? null,
			})
			.pipe(
				Effect.map(toGoalView),
				Effect.mapError((cause) => new GoalPlanningError({ goalId: "new", cause })),
			),

	get: (goalId: string) =>
		repo.getGoal(goalId).pipe(
			Effect.flatMap((goal) =>
				goal ? Effect.succeed(toGoalView(goal)) : Effect.fail(new GoalNotFoundError({ goalId })),
			),
			Effect.mapError((cause) =>
				cause instanceof GoalNotFoundError ? cause : new GoalPlanningError({ goalId, cause }),
			),
		),

	plan: (goalId: string, options?: PlanGoalOptions) =>
		Effect.gen(function* () {
			const goal = yield* repo.getGoal(goalId);
			if (!goal) return yield* Effect.fail(new GoalNotFoundError({ goalId }));

			const milestones = buildPlan(goal, options);

			const updated = yield* repo.updateMilestones(goalId, milestones);
			return toGoalView(updated);
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof GoalNotFoundError ? cause : new GoalPlanningError({ goalId, cause }),
			),
		),

	workloadSummary: () =>
		Effect.gen(function* () {
			const assignments = yield* repo.listAssignments();
			const tasks = yield* repo.listTasks();
			const goals = yield* repo.listGoals();

			const workloads = buildWorkloads(assignments);

			const tasksWithDue = tasks.filter((t): t is (typeof tasks)[number] & { dueAt: Date } =>
				Boolean(t.dueAt),
			);

			const upcomingDeadlines = tasksWithDue
				.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
				.slice(0, 5)
				.map((t) => ({
					taskId: t.id,
					title: t.title,
					dueAt: t.dueAt.toISOString(),
				}));

			const goalProgress = buildGoalProgress(goals);

			const summary: WorkloadSummary = {
				workloads,
				upcomingDeadlines,
				goalProgress,
				computedAt: new Date().toISOString(),
			};

			return summary;
		}).pipe(Effect.mapError((cause) => new GoalPlanningError({ goalId: "summary", cause }))),
});

export const GoalServiceLive = Layer.effect(
	GoalService,
	Effect.gen(function* () {
		const repo = yield* GoalRepositoryTag;
		return makeService(repo);
	}),
);
