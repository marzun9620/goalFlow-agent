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

	listCandidates: (filter?: {
		hasAnySkills?: string[];
		minAvailableHours?: number;
		excludePersonIds?: string[];
		includePersonIds?: string[];
	}) =>
		Effect.tryPromise({
			try: () =>
				client.person.findMany({
					where: {
						AND: [
							filter?.includePersonIds ? { id: { in: filter.includePersonIds } } : {},
							filter?.excludePersonIds ? { id: { notIn: filter.excludePersonIds } } : {},
							filter?.hasAnySkills?.length
								? {
										skills: {
											some: { skillId: { in: filter.hasAnySkills } },
										},
									}
								: {},
							filter?.minAvailableHours != null
								? {
										weeklyCapacityHours: { gte: filter.minAvailableHours },
									}
								: {},
						],
					},
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
				persons
					.map((p) => ({
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
					}))
					.filter((p) => {
						if (filter?.minAvailableHours == null) return true;
						const available = (p.weeklyCapacityHours ?? 0) - (p.currentLoadHours ?? 0);
						return available >= filter.minAvailableHours;
					}),
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
