import type { PrismaClient } from "@prisma/client";
import { Effect, Layer } from "effect";
import { Database } from "../runtime/database.js";
import { MatchingRepositoryError } from "../use-cases/matching/errors.js";
import { MatchingRepository } from "../use-cases/matching/repository.js";

const toError = (operation: string) => (cause: unknown) =>
	new MatchingRepositoryError({ operation, cause });

const makeService = (client: PrismaClient) => ({
	getTask: (taskId: string) =>
		Effect.tryPromise({
			try: () =>
				client.task.findUnique({
					where: { id: taskId },
					include: {
						requiredSkills: {
							include: { skill: true },
						},
					},
				}),
			catch: toError("getTask"),
		}),

	listCandidates: () =>
		Effect.tryPromise({
			try: () =>
				client.person.findMany({
					include: {
						skills: {
							include: {
								skill: true,
							},
						},
					},
				}),
			catch: toError("listCandidates"),
		}).pipe(
			Effect.map((persons) =>
				persons.map((p) => ({
					personId: p.id,
					personName: p.name,
					weeklyCapacityHours: p.weeklyCapacityHours,
					currentLoadHours: p.currentLoadHours,
					skills: p.skills.map((ps) => ({
						skillId: ps.skillId,
						skillName: ps.skill.name,
						level: ps.level,
						years: ps.years,
					})),
				})),
			),
		),
});

export const MatchingRepositoryLive = Layer.effect(
	MatchingRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return makeService(db.client);
	}),
);
