import type { PrismaClient } from "@prisma/client";
import { Effect, Layer } from "effect";
import { Database } from "../runtime/database.js";
import { SchedulingRepositoryError } from "../use-cases/scheduling/errors.js";
import { SchedulingRepository } from "../use-cases/scheduling/repository.js";

const toError = (operation: string) => (cause: unknown) =>
	new SchedulingRepositoryError({ operation, cause });

const makeService = (client: PrismaClient) => ({
	getTask: (taskId: string) =>
		Effect.tryPromise({
			try: () =>
				client.task.findUnique({
					where: { id: taskId },
				}),
			catch: toError("getTask"),
		}),

	listPeople: () =>
		Effect.tryPromise({
			try: () =>
				client.person.findMany({
					select: {
						id: true,
						name: true,
						timezone: true,
						weeklyCapacityHours: true,
						currentLoadHours: true,
					},
				}),
			catch: toError("listPeople"),
		}),

	getPersonEvents: (personId: string, start: Date, end: Date) =>
		Effect.tryPromise({
			try: () =>
				client.calendarEvent.findMany({
					where: {
						personId,
						startAt: { lte: end },
						endAt: { gte: start },
					},
					orderBy: { startAt: "asc" },
				}),
			catch: toError("getPersonEvents"),
		}),

	getPersonAssignments: (personId: string, start: Date, end: Date) =>
		Effect.tryPromise({
			try: () =>
				client.taskAssignment.findMany({
					where: {
						personId,
						task: {
							dueAt: {
								gte: start,
								lte: end,
							},
						},
					},
					include: {
						task: {
							select: {
								title: true,
								dueAt: true,
								effortHours: true,
							},
						},
					},
					orderBy: { createdAt: "asc" },
				}),
			catch: toError("getPersonAssignments"),
		}),
});

export const SchedulingRepositoryLive = Layer.effect(
	SchedulingRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return makeService(db.client);
	}),
);
