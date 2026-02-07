import type { Prisma, PrismaClient } from "@prisma/client";
import { Effect, Layer } from "effect";
import type { Milestone } from "../domain/goals/types.js";
import { Database } from "../runtime/database.js";
import { GoalRepositoryError } from "../use-cases/goals/errors.js";
import { GoalRepository } from "../use-cases/goals/repository.js";

const toError = (operation: string) => (cause: unknown) =>
	new GoalRepositoryError({ operation, cause });

const makeService = (client: PrismaClient) => ({
	createGoal: (input: {
		title: string;
		ownerId?: string | null;
		targetDate?: Date | null;
		status?: string | null;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.goal.create({
					data: {
						title: input.title,
						ownerId: input.ownerId ?? null,
						targetDate: input.targetDate ?? null,
						status: input.status ?? null,
					},
				}),
			catch: toError("createGoal"),
		}),

	getGoal: (id: string) =>
		Effect.tryPromise({
			try: () =>
				client.goal.findUnique({
					where: { id },
				}),
			catch: toError("getGoal"),
		}),

	updateMilestones: (id: string, milestones: Milestone[]) =>
		Effect.tryPromise({
			try: () =>
				client.goal.update({
					where: { id },
					data: { milestones: milestones as Prisma.InputJsonValue },
				}),
			catch: toError("updateMilestones"),
		}),

	listAssignments: () =>
		Effect.tryPromise({
			try: () =>
				client.taskAssignment.findMany({
					include: {
						person: { select: { id: true, name: true } },
						task: { select: { id: true, title: true, dueAt: true, effortHours: true } },
					},
				}),
			catch: toError("listAssignments"),
		}),

	listTasks: () =>
		Effect.tryPromise({
			try: () => client.task.findMany(),
			catch: toError("listTasks"),
		}),

	listGoals: () =>
		Effect.tryPromise({
			try: () => client.goal.findMany(),
			catch: toError("listGoals"),
		}),
});

export const GoalRepositoryLive = Layer.effect(
	GoalRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return makeService(db.client);
	}),
);
