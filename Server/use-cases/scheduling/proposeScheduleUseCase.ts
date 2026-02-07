import { Context, Effect, Layer } from "effect";
import { TaskNotFoundError } from "../../domain/matching/errors.js";
import type { Conflict, ScheduleProposal, TimeSlot } from "../../domain/scheduling/types.js";
import { NoScheduleAvailableError, SchedulingFlowError } from "./errors.js";
import type { AssignmentRecord, SchedulingRepository } from "./repository.js";
import { SchedulingRepository as SchedulingRepositoryTag } from "./repository.js";

export interface ScheduleOptions {
	startDate?: string; // ISO date
	endDate?: string; // ISO date
	maxResults?: number;
}

export interface ProposeScheduleUseCase {
	propose: (
		taskId: string,
		options?: ScheduleOptions,
	) => Effect.Effect<
		ScheduleProposal,
		SchedulingFlowError | TaskNotFoundError | NoScheduleAvailableError
	>;
}

export const ProposeScheduleUseCase =
	Context.GenericTag<ProposeScheduleUseCase>("ProposeScheduleUseCase");

const WORKDAY_HOURS = 8;
const SLOT_START_HOUR = 9; // 09:00 local (treated as UTC for now)

type InputEvent = {
	startAt: Date;
	endAt: Date;
	id: string;
	type: "event" | "assignment";
	source?: string | null;
	eventType?: string | null;
	title?: string | null;
};

const toDate = (value?: string): Date | undefined => {
	if (!value) return undefined;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? undefined : d;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const hoursBetween = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 3_600_000;

const startOfDay = (d: Date) =>
	new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

const dayRange = function* (start: Date, end: Date) {
	let cursor = startOfDay(start);
	const limit = startOfDay(end);
	while (cursor <= limit) {
		yield cursor;
		cursor = addDays(cursor, 1);
	}
};

const findFirstSlot = (
	personId: string,
	events: InputEvent[],
	rangeStart: Date,
	rangeEnd: Date,
	slotHours: number,
): { slot: TimeSlot; conflicts: Conflict[]; freeHours: number } | null => {
	for (const day of dayRange(rangeStart, rangeEnd)) {
		const workStart = new Date(day.getTime() + SLOT_START_HOUR * 3_600_000);
		const workEnd = new Date(workStart.getTime() + WORKDAY_HOURS * 3_600_000);

		const dayEvents = events
			.filter((ev) => ev.startAt < workEnd && ev.endAt > workStart)
			.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

		let cursor = workStart;
		for (const ev of dayEvents) {
			const evStart = ev.startAt < workStart ? workStart : ev.startAt;
			const evEnd = ev.endAt > workEnd ? workEnd : ev.endAt;
			if (hoursBetween(cursor, evStart) >= slotHours) {
				const slotEnd = new Date(cursor.getTime() + slotHours * 3_600_000);
				return {
					slot: {
						start: cursor.toISOString(),
						end: slotEnd.toISOString(),
						personId,
						availabilityScore: clamp(hoursBetween(cursor, evStart) / WORKDAY_HOURS, 0, 1),
					},
					conflicts: dayEvents.map((ev2) => ({
						personId,
						type: ev2.type,
						start: ev2.startAt.toISOString(),
						end: ev2.endAt.toISOString(),
						title: ev2.title ?? ev2.eventType,
						source: ev2.source,
						reason: ev2.type === "assignment" ? "Existing task assignment" : "Calendar event",
					})),
					freeHours: hoursBetween(cursor, evStart),
				};
			}
			if (evEnd > cursor) {
				cursor = evEnd;
			}
		}

		if (hoursBetween(cursor, workEnd) >= slotHours) {
			const slotEnd = new Date(cursor.getTime() + slotHours * 3_600_000);
			return {
				slot: {
					start: cursor.toISOString(),
					end: slotEnd.toISOString(),
					personId,
					availabilityScore: clamp(hoursBetween(cursor, workEnd) / WORKDAY_HOURS, 0, 1),
				},
				conflicts: dayEvents.map((ev2) => ({
					personId,
					type: ev2.type,
					start: ev2.startAt.toISOString(),
					end: ev2.endAt.toISOString(),
					title: ev2.title ?? ev2.eventType,
					source: ev2.source,
					reason: ev2.type === "assignment" ? "Existing task assignment" : "Calendar event",
				})),
				freeHours: hoursBetween(cursor, workEnd),
			};
		}
	}
	return null;
};

const assignmentToEvent = (assignment: AssignmentRecord): InputEvent | null => {
	const due = assignment.task.dueAt ? new Date(assignment.task.dueAt) : null;
	if (!due) return null;
	const start = new Date(startOfDay(due).getTime() + SLOT_START_HOUR * 3_600_000);
	const hours = clamp(
		Number(assignment.allocatedHours ?? assignment.task.effortHours ?? 2),
		1,
		WORKDAY_HOURS,
	);
	const end = new Date(start.getTime() + hours * 3_600_000);
	const workEnd = new Date(
		startOfDay(due).getTime() + (SLOT_START_HOUR + WORKDAY_HOURS) * 3_600_000,
	);
	const clampedEnd = end > workEnd ? workEnd : end;

	return {
		id: assignment.id,
		startAt: start,
		endAt: clampedEnd,
		type: "assignment",
		eventType: "assignment",
		title: assignment.task.title,
	};
};

const buildUseCase = (repo: SchedulingRepository): ProposeScheduleUseCase => ({
	propose: (taskId: string, options?: ScheduleOptions) =>
		Effect.gen(function* () {
			const rangeStart = toDate(options?.startDate) ?? new Date();
			const requestedEnd = toDate(options?.endDate);
			const maxResults = options?.maxResults ?? 5;

			const task = yield* repo
				.getTask(taskId)
				.pipe(Effect.mapError((cause) => new SchedulingFlowError({ operation: "getTask", cause })));

			if (!task) return yield* Effect.fail(new TaskNotFoundError({ taskId }));

			const dueAt = task.dueAt ? new Date(task.dueAt) : undefined;

			let rangeEnd = requestedEnd ?? dueAt ?? addDays(rangeStart, 7);
			if (dueAt && rangeEnd > dueAt) {
				rangeEnd = dueAt;
			}
			if (rangeEnd < rangeStart) {
				return yield* Effect.fail(new NoScheduleAvailableError({ taskId }));
			}

			const effortHours = task.effortHours ? Number(task.effortHours) : 1;
			const slotHours = clamp(effortHours, 1, WORKDAY_HOURS);

			const people = yield* repo
				.listPeople()
				.pipe(
					Effect.mapError((cause) => new SchedulingFlowError({ operation: "listPeople", cause })),
				);

			const candidates: {
				slot: TimeSlot;
				conflicts: Conflict[];
				personName: string;
				freeHours: number;
			}[] = [];

			for (const person of people) {
				const availableWeekly =
					(person.weeklyCapacityHours ?? WORKDAY_HOURS * 5) - (person.currentLoadHours ?? 0);
				if (availableWeekly <= 0) continue;

				const events = yield* repo
					.getPersonEvents(person.id, rangeStart, rangeEnd)
					.pipe(
						Effect.mapError(
							(cause) => new SchedulingFlowError({ operation: "getPersonEvents", cause }),
						),
					);

				const assignments = yield* repo
					.getPersonAssignments(person.id, rangeStart, rangeEnd)
					.pipe(
						Effect.mapError(
							(cause) => new SchedulingFlowError({ operation: "getPersonAssignments", cause }),
						),
					);

				const assignmentEvents = assignments
					.map(assignmentToEvent)
					.filter((ev): ev is InputEvent => ev !== null);

				const normalizedEvents: InputEvent[] = [
					...events.map((ev) => ({
						...ev,
						type: "event" as const,
					})),
					...assignmentEvents,
				];

				const result = findFirstSlot(person.id, normalizedEvents, rangeStart, rangeEnd, slotHours);
				if (result) {
					candidates.push({
						...result,
						personName: person.name,
					});
				}
			}

			if (candidates.length === 0) {
				return yield* Effect.fail(new NoScheduleAvailableError({ taskId }));
			}

			candidates.sort((a, b) => {
				if (b.slot.availabilityScore === a.slot.availabilityScore) {
					return a.personName.localeCompare(b.personName);
				}
				return b.slot.availabilityScore - a.slot.availabilityScore;
			});

			const top = candidates.slice(0, maxResults);
			const proposal: ScheduleProposal = {
				taskId,
				proposedSlots: top.map((c) => c.slot),
				recommendation: top[0]?.slot,
				conflicts: top.flatMap((c) => c.conflicts),
				computedAt: new Date().toISOString(),
			};

			return proposal;
		}),
});

export const ProposeScheduleUseCaseLive = Layer.effect(
	ProposeScheduleUseCase,
	Effect.gen(function* () {
		const repo = yield* SchedulingRepositoryTag;
		return buildUseCase(repo);
	}),
);
