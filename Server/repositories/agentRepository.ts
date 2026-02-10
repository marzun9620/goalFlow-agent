import type { Prisma, PrismaClient, SkillLevel } from "@prisma/client";
import { Effect, Layer } from "effect";
import { Database } from "../runtime/database.js";
import { AgentRepositoryError } from "../use-cases/agent/errors.js";
import { AgentRepository } from "../use-cases/agent/repository.js";

const toError = (operation: string) => (cause: unknown) =>
	new AgentRepositoryError({ operation, cause });

const SKILL_LEVELS = new Set<SkillLevel>([
	"BEGINNER",
	"JUNIOR",
	"INTERMEDIATE",
	"MID",
	"SENIOR",
	"EXPERT",
	"PRINCIPAL",
]);

const toSkillLevel = (level?: string | null): SkillLevel | null => {
	if (!level) return null;
	const normalized = level.trim().toUpperCase() as SkillLevel;
	return SKILL_LEVELS.has(normalized) ? normalized : null;
};

const makeService = (client: PrismaClient) => ({
	createConversation: (input?: { title?: string | null }) =>
		Effect.tryPromise({
			try: () =>
				client.conversation.create({
					data: {
						title: input?.title ?? null,
					},
				}),
			catch: toError("createConversation"),
		}),

	appendMessage: (input: {
		conversationId: string;
		role: "USER" | "ASSISTANT" | "SYSTEM";
		content: string;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.conversationMessage.create({
					data: {
						conversationId: input.conversationId,
						role: input.role,
						content: input.content,
					},
				}),
			catch: toError("appendMessage"),
		}),

	createRun: (input: {
		conversationId: string;
		status?: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
		data: {
			input: unknown;
			proposal: unknown;
		};
	}) =>
		Effect.tryPromise({
			try: () =>
				client.agentRun.create({
					data: {
						conversationId: input.conversationId,
						status: input.status ?? "PROPOSED",
						input: input.data.input as Prisma.InputJsonValue,
						proposal: input.data.proposal as Prisma.InputJsonValue,
					},
				}),
			catch: toError("createRun"),
		}),

	getConversationSnapshot: (conversationId: string) =>
		Effect.tryPromise({
			try: async () => {
				const conversation = await client.conversation.findUnique({
					where: { id: conversationId },
				});
				if (!conversation) return null;

				const [messages, runs, actions] = await Promise.all([
					client.conversationMessage.findMany({
						where: { conversationId },
						orderBy: { createdAt: "asc" },
					}),
					client.agentRun.findMany({
						where: { conversationId },
						orderBy: { createdAt: "desc" },
					}),
					client.agentAction.findMany({
						where: {
							run: {
								conversationId,
							},
						},
						orderBy: { createdAt: "asc" },
					}),
				]);

				return {
					conversation,
					messages,
					runs,
					actions,
				};
			},
			catch: toError("getConversationSnapshot"),
		}),

	searchPeopleByName: (name: string) =>
		Effect.tryPromise({
			try: () =>
				client.person.findMany({
					where: {
						name: {
							contains: name,
							mode: "insensitive",
						},
					},
					orderBy: { name: "asc" },
					take: 10,
					include: {
						skills: {
							include: {
								skill: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				}),
			catch: toError("searchPeopleByName"),
		}).pipe(
			Effect.map((people) =>
				people.map((person) => ({
					id: person.id,
					name: person.name,
					weeklyCapacityHours: person.weeklyCapacityHours,
					currentLoadHours: person.currentLoadHours,
					skills: person.skills.map((skill) => ({
						name: skill.skill.name,
						level: skill.level ? skill.level.toLowerCase() : null,
						years: skill.years,
					})),
				})),
			),
		),

	getRunById: (runId: string) =>
		Effect.tryPromise({
			try: () => client.agentRun.findUnique({ where: { id: runId } }),
			catch: toError("getRunById"),
		}),

	updateRunStatus: (
		runId: string,
		status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED",
	) =>
		Effect.tryPromise({
			try: () =>
				client.agentRun.update({
					where: { id: runId },
					data: { status },
				}),
			catch: toError("updateRunStatus"),
		}),

	updateRunData: (runId: string, data: { input?: unknown; proposal?: unknown }) =>
		Effect.tryPromise({
			try: () =>
				client.agentRun.update({
					where: { id: runId },
					data: {
						...(data.input !== undefined ? { input: data.input as Prisma.InputJsonValue } : {}),
						...(data.proposal !== undefined
							? { proposal: data.proposal as Prisma.InputJsonValue }
							: {}),
					},
				}),
			catch: toError("updateRunData"),
		}),

	createAction: (input: {
		runId: string;
		type: string;
		status?: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";
		payload?: unknown;
		error?: string | null;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.agentAction.create({
					data: {
						runId: input.runId,
						type: input.type,
						status: input.status ?? "PENDING",
						payload: (input.payload ?? null) as Prisma.InputJsonValue,
						error: input.error ?? null,
					},
				}),
			catch: toError("createAction"),
		}),

	updateAction: (input: {
		actionId: string;
		status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";
		payload?: unknown;
		error?: string | null;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.agentAction.update({
					where: { id: input.actionId },
					data: {
						status: input.status,
						...(input.payload !== undefined
							? { payload: input.payload as Prisma.InputJsonValue }
							: {}),
						...(input.error !== undefined ? { error: input.error } : {}),
					},
				}),
			catch: toError("updateAction"),
		}),

	upsertGoalByTitle: (input: { title: string; status?: string | null }) =>
		Effect.tryPromise({
			try: async () => {
				const existing = await client.goal.findFirst({
					where: {
						title: {
							equals: input.title,
							mode: "insensitive",
						},
					},
				});
				if (!existing) {
					return client.goal.create({
						data: {
							title: input.title,
							status: input.status ?? "planned",
						},
					});
				}
				return client.goal.update({
					where: { id: existing.id },
					data: {
						status: input.status ?? existing.status,
					},
				});
			},
			catch: toError("upsertGoalByTitle"),
		}),

	upsertPerson: (input: {
		personId?: string | null;
		name: string;
		weeklyCapacityHours?: number | null;
	}) =>
		Effect.tryPromise({
			try: async () => {
				const byId = input.personId
					? await client.person.findUnique({
							where: { id: input.personId },
						})
					: null;
				if (byId) {
					return client.person.update({
						where: { id: byId.id },
						data: {
							weeklyCapacityHours: input.weeklyCapacityHours ?? byId.weeklyCapacityHours,
						},
						include: {
							skills: {
								include: {
									skill: {
										select: { name: true },
									},
								},
							},
						},
					});
				}

				const byName = await client.person.findFirst({
					where: {
						name: {
							equals: input.name,
							mode: "insensitive",
						},
					},
					include: {
						skills: {
							include: {
								skill: {
									select: { name: true },
								},
							},
						},
					},
				});
				if (byName) {
					return client.person.update({
						where: { id: byName.id },
						data: {
							weeklyCapacityHours: input.weeklyCapacityHours ?? byName.weeklyCapacityHours,
						},
						include: {
							skills: {
								include: {
									skill: {
										select: { name: true },
									},
								},
							},
						},
					});
				}

				return client.person.create({
					data: {
						name: input.name,
						weeklyCapacityHours: input.weeklyCapacityHours ?? 40,
					},
					include: {
						skills: {
							include: {
								skill: {
									select: { name: true },
								},
							},
						},
					},
				});
			},
			catch: toError("upsertPerson"),
		}).pipe(
			Effect.map((person) => ({
				id: person.id,
				name: person.name,
				weeklyCapacityHours: person.weeklyCapacityHours,
				currentLoadHours: person.currentLoadHours,
				skills: person.skills.map((skill) => ({
					name: skill.skill.name,
					level: skill.level ? skill.level.toLowerCase() : null,
					years: skill.years,
				})),
			})),
		),

	upsertMemberSkill: (input: {
		personId: string;
		skillName: string;
		level?: string | null;
		years?: number | null;
	}) =>
		Effect.tryPromise({
			try: async () => {
				const existingSkill = await client.skill.findFirst({
					where: {
						name: {
							equals: input.skillName,
							mode: "insensitive",
						},
					},
				});
				const skill =
					existingSkill ??
					(await client.skill.create({
						data: {
							name: input.skillName,
						},
					}));

				await client.personSkill.upsert({
					where: {
						personId_skillId: {
							personId: input.personId,
							skillId: skill.id,
						},
					},
					update: {
						level: toSkillLevel(input.level) ?? undefined,
						years: input.years ?? undefined,
					},
					create: {
						personId: input.personId,
						skillId: skill.id,
						level: toSkillLevel(input.level) ?? undefined,
						years: input.years ?? undefined,
					},
				});
			},
			catch: toError("upsertMemberSkill"),
		}),

	createTask: (input: { title: string; effortHours?: number | null }) =>
		Effect.tryPromise({
			try: () =>
				client.task.create({
					data: {
						title: input.title,
						effortHours: input.effortHours ?? 8,
					},
					select: {
						id: true,
						title: true,
						effortHours: true,
					},
				}),
			catch: toError("createTask"),
		}).pipe(
			Effect.map((task) => ({
				id: task.id,
				title: task.title,
				effortHours: task.effortHours ? Number(task.effortHours) : null,
			})),
		),

	createTaskAssignment: (input: {
		taskId: string;
		personId: string;
		allocatedHours?: number | null;
	}) =>
		Effect.tryPromise({
			try: () =>
				client.taskAssignment.upsert({
					where: {
						taskId_personId: {
							taskId: input.taskId,
							personId: input.personId,
						},
					},
					update: {
						allocatedHours: input.allocatedHours ?? null,
						status: "assigned",
					},
					create: {
						taskId: input.taskId,
						personId: input.personId,
						allocatedHours: input.allocatedHours ?? null,
						status: "assigned",
					},
					select: {
						id: true,
						taskId: true,
						personId: true,
						allocatedHours: true,
					},
				}),
			catch: toError("createTaskAssignment"),
		}).pipe(
			Effect.map((assignment) => ({
				id: assignment.id,
				taskId: assignment.taskId,
				personId: assignment.personId,
				allocatedHours: assignment.allocatedHours ? Number(assignment.allocatedHours) : null,
			})),
		),

	incrementPersonLoad: (input: { personId: string; hours: number }) =>
		Effect.tryPromise({
			try: () =>
				client.person.update({
					where: { id: input.personId },
					data: {
						currentLoadHours: {
							increment: Math.max(0, Math.round(input.hours)),
						},
					},
				}),
			catch: toError("incrementPersonLoad"),
		}).pipe(Effect.asVoid),

	getActionsByRunId: (runId: string) =>
		Effect.tryPromise({
			try: () =>
				client.agentAction.findMany({
					where: { runId },
					orderBy: { createdAt: "asc" },
				}),
			catch: toError("getActionsByRunId"),
		}),
});

export const AgentRepositoryLive = Layer.effect(
	AgentRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return makeService(db.client);
	}),
);
