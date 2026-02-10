import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { AgentChatService, AgentChatServiceLive } from "./chatService.js";
import type { AgentRepository } from "./repository.js";
import { AgentRepository as AgentRepositoryTag } from "./repository.js";

const createRepositoryLayer = (
	search: (name: string) => Array<{
		id: string;
		name: string;
		weeklyCapacityHours: number | null;
		currentLoadHours?: number;
	}>,
): Layer.Layer<AgentRepository> =>
	Layer.succeed(AgentRepositoryTag, {
		createConversation: (input) =>
			Effect.succeed({
				id: "conversation-1",
				title: input?.title ?? null,
				createdAt: new Date("2026-02-09T00:00:00.000Z"),
				updatedAt: new Date("2026-02-09T00:00:00.000Z"),
			}),
		appendMessage: (input) =>
			Effect.succeed({
				id: `message-${input.role.toLowerCase()}`,
				conversationId: input.conversationId,
				role: input.role,
				content: input.content,
				createdAt: new Date("2026-02-09T00:00:00.000Z"),
			}),
		createRun: (input) =>
			Effect.succeed({
				id: "run-1",
				conversationId: input.conversationId,
				status: input.status ?? "PROPOSED",
				input: input.data.input,
				proposal: input.data.proposal,
				createdAt: new Date("2026-02-09T00:00:00.000Z"),
				updatedAt: new Date("2026-02-09T00:00:00.000Z"),
			}),
		getConversationSnapshot: () => Effect.succeed(null),
		searchPeopleByName: (name) =>
			Effect.succeed(
				search(name).map((person) => ({
					id: person.id,
					name: person.name,
					weeklyCapacityHours: person.weeklyCapacityHours,
					currentLoadHours: person.currentLoadHours ?? 0,
					skills: [],
				})),
			),
		getRunById: () => Effect.succeed(null),
		updateRunStatus: () => Effect.die("not used"),
		updateRunData: () => Effect.die("not used"),
		createAction: () => Effect.die("not used"),
		updateAction: () => Effect.die("not used"),
		upsertGoalByTitle: () => Effect.die("not used"),
		upsertPerson: () => Effect.die("not used"),
		upsertMemberSkill: () => Effect.die("not used"),
		createTask: () => Effect.die("not used"),
		createTaskAssignment: () => Effect.die("not used"),
		incrementPersonLoad: () => Effect.die("not used"),
		getActionsByRunId: () => Effect.succeed([]),
	} as AgentRepository);

const runChat = async (
	message: string,
	search: (name: string) => Array<{ id: string; name: string; weeklyCapacityHours: number | null }>,
) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const service = yield* AgentChatService;
			return yield* service.chat({ message });
		}).pipe(
			Effect.provide(Layer.provideMerge(AgentChatServiceLive, createRepositoryLayer(search))),
		),
	);

describe("AgentChatService intent parsing", () => {
	it("parses project/tasks/members and resolves existing people", async () => {
		const result = await runChat(
			"New project Phoenix, add tasks API/Frontend/QA, include Sam and Maya, distribute by capacity",
			(name) => {
				if (name.toLowerCase() === "sam") {
					return [{ id: "person-sam", name: "Sam", weeklyCapacityHours: 35 }];
				}
				return [];
			},
		);

		expect(result.proposal.intent.project?.name).toBe("Phoenix");
		expect(result.proposal.intent.tasks).toEqual(["API", "Frontend", "QA"]);
		expect(result.proposal.intent.distributionMode).toBe("capacity");

		const sam = result.proposal.intent.members.find((member) => member.name === "Sam");
		const maya = result.proposal.intent.members.find((member) => member.name === "Maya");
		expect(sam?.resolution).toBe("existing");
		expect(sam?.existingPersonId).toBe("person-sam");
		expect(maya?.resolution).toBe("new");
		expect(result.proposal.intent.followUps).toContain(
			"What weekly capacity (hours/week) should I use for Maya?",
		);
	});

	it("returns clarification prompt for ambiguous member names", async () => {
		const result = await runChat(
			"New project Atlas, add tasks API, include Sam, distribute by capacity",
			(name) => {
				if (name.toLowerCase() === "sam") {
					return [
						{ id: "person-sam-1", name: "Sam Rodriguez", weeklyCapacityHours: 40 },
						{ id: "person-sam-2", name: "Sam Lee", weeklyCapacityHours: 30 },
					];
				}
				return [];
			},
		);

		const sam = result.proposal.intent.members.find((member) => member.name === "Sam");
		expect(sam?.resolution).toBe("ambiguous");
		expect(
			result.proposal.intent.followUps.some((question) =>
				question.includes("Which Sam do you mean"),
			),
		).toBe(true);
	});

	it("asks for skill level when skill was provided without one", async () => {
		const result = await runChat(
			"New project Atlas, add tasks API, include Maya: TypeScript 3y, distribute by capacity",
			() => [],
		);

		const maya = result.proposal.intent.members.find((member) => member.name === "Maya");
		expect(maya?.skills[0]?.name.toLowerCase()).toBe("typescript");
		expect(maya?.skills[0]?.level).toBeNull();
		expect(result.proposal.intent.followUps).toContain(
			"What level should I record for Maya's TypeScript skill?",
		);
	});
});
