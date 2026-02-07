import { Decimal } from "@prisma/client/runtime/library";
import { Effect, Layer } from "effect";
import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import { TaskNotFoundError } from "../../domain/matching/errors.js";
import { NoScheduleAvailableError } from "./errors.js";
import {
	ProposeScheduleUseCase,
	ProposeScheduleUseCaseLive,
	type ScheduleOptions,
} from "./proposeScheduleUseCase.js";
import type {
	AssignmentRecord,
	CalendarEventRecord,
	PersonRecord,
	SchedulingRepository,
	TaskRecord,
} from "./repository.js";
import { SchedulingRepository as SchedulingRepositoryTag } from "./repository.js";

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
	id: "task-1",
	title: "Schedule Test",
	description: null,
	priority: null,
	effortHours: new Decimal(4),
	dueAt: null,
	ownerId: null,
	sensitivityLevel: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
});

const makeAssignment = (overrides: Partial<AssignmentRecord> = {}): AssignmentRecord => ({
	id: "assign-1",
	taskId: "task-2",
	personId: "person-1",
	allocatedHours: new Decimal(2),
	status: null,
	createdAt: new Date(),
	task: {
		title: "Existing Task",
		dueAt: new Date("2026-02-10T00:00:00Z"),
		effortHours: new Decimal(2),
	},
	...overrides,
});

const makePerson = (overrides: Partial<PersonRecord> = {}): PersonRecord => ({
	id: "person-1",
	name: "Alice",
	timezone: "UTC",
	weeklyCapacityHours: 40,
	currentLoadHours: 0,
	...overrides,
});

const makeEvent = (overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord => ({
	id: "ev-1",
	personId: "person-1",
	startAt: new Date("2026-02-10T10:00:00Z"),
	endAt: new Date("2026-02-10T12:00:00Z"),
	eventType: "meeting",
	externalId: null,
	source: "google",
	createdAt: new Date(),
	...overrides,
});

const mockRepo = (impl: Partial<SchedulingRepository>): Layer.Layer<SchedulingRepository> =>
	Layer.succeed(SchedulingRepositoryTag, {
		getTask: () => Effect.succeed(null),
		listPeople: () => Effect.succeed([]),
		getPersonEvents: () => Effect.succeed([]),
		getPersonAssignments: () => Effect.succeed([]),
		...impl,
	} as SchedulingRepository);

const run = (
	repoImpl: Partial<SchedulingRepository>,
	taskId = "task-1",
	options: ScheduleOptions = {},
) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const useCase = yield* ProposeScheduleUseCase;
			return yield* useCase.propose(taskId, options);
		}).pipe(
			Effect.provide(Layer.provideMerge(ProposeScheduleUseCaseLive, mockRepo(repoImpl))),
			Effect.either,
		),
	);

describe("ProposeScheduleUseCase", () => {
	it("returns earliest available slot for a free person", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(makeTask()),
			listPeople: () => Effect.succeed([makePerson()]),
			getPersonEvents: () => Effect.succeed([]),
		};

		const result = await run(repo);
		if (Either.isLeft(result)) throw new Error("unexpected failure");

		expect(result.right.proposedSlots[0]).toMatchObject({
			personId: "person-1",
			availabilityScore: 1,
		});
	});

	it("skips people with overlapping events and picks the next", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(makeTask()),
			listPeople: () =>
				Effect.succeed([
					makePerson({ id: "busy", name: "Busy" }),
					makePerson({ id: "free", name: "Free" }),
				]),
			getPersonEvents: (personId) =>
				personId === "busy" ? Effect.succeed([makeEvent()]) : Effect.succeed([]),
		};

		const result = await run(repo, "task-1", { startDate: "2026-02-10", endDate: "2026-02-10" });
		if (Either.isLeft(result)) throw new Error("unexpected failure");

		expect(result.right.recommendation?.personId).toBe("free");
	});

	it("returns conflicts when events overlap the chosen day", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(makeTask()),
			listPeople: () => Effect.succeed([makePerson()]),
			getPersonEvents: () =>
				Effect.succeed([
					makeEvent({
						startAt: new Date("2026-02-10T09:30:00Z"),
						endAt: new Date("2026-02-10T10:30:00Z"),
					}),
				]),
		};

		const result = await run(repo, "task-1", {
			startDate: "2026-02-10",
			endDate: "2026-02-10",
		});
		if (Either.isLeft(result)) throw new Error("unexpected failure");

		expect(result.right.conflicts.length).toBeGreaterThan(0);
		expect(result.right.proposedSlots[0].availabilityScore).toBeLessThan(1);
	});

	it("fails with TaskNotFoundError when task missing", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(null),
			listPeople: () => Effect.succeed([]),
			getPersonEvents: () => Effect.succeed([]),
		};

		const result = await run(repo);
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left?._tag).toBe("TaskNotFoundError");
		}
	});

	it("fails when no schedule fits within range", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(makeTask({ effortHours: new Decimal(8) })),
			listPeople: () => Effect.succeed([makePerson()]),
			getPersonEvents: () =>
				Effect.succeed([
					makeEvent({
						startAt: new Date("2026-02-10T09:00:00Z"),
						endAt: new Date("2026-02-10T17:00:00Z"),
					}),
				]),
		};

		const result = await run(repo, "task-1", { startDate: "2026-02-10", endDate: "2026-02-10" });
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left?._tag).toBe("NoScheduleAvailableError");
		}
	});

	it("returns conflicts for existing assignments on the same day", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () => Effect.succeed(makeTask()),
			listPeople: () => Effect.succeed([makePerson()]),
			getPersonEvents: () => Effect.succeed([]),
			getPersonAssignments: () => Effect.succeed([makeAssignment()]),
		};

		const result = await run(repo, "task-1", { startDate: "2026-02-10", endDate: "2026-02-10" });
		if (Either.isLeft(result)) throw new Error("unexpected failure");

		expect(result.right.conflicts.some((c) => c.type === "assignment")).toBe(true);
	});

	it("fails when task due date is before requested range", async () => {
		const repo: Partial<SchedulingRepository> = {
			getTask: () =>
				Effect.succeed(
					makeTask({
						dueAt: new Date("2026-02-09T00:00:00Z"),
					}),
				),
			listPeople: () => Effect.succeed([makePerson()]),
			getPersonEvents: () => Effect.succeed([]),
			getPersonAssignments: () => Effect.succeed([]),
		};

		const result = await run(repo, "task-1", { startDate: "2026-02-10", endDate: "2026-02-12" });
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left?._tag).toBe("NoScheduleAvailableError");
		}
	});
});
