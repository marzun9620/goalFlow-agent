import type { CalendarEvent, Person, Task, TaskAssignment } from "@prisma/client";
import { Context, type Effect } from "effect";
import type { SchedulingRepositoryError } from "./errors.js";

export interface TaskRecord extends Task {
	effortHours: Task["effortHours"];
	dueAt: Task["dueAt"];
}

export interface PersonRecord {
	id: string;
	name: string;
	timezone: string | null;
	weeklyCapacityHours: number | null;
	currentLoadHours: number;
}

export interface CalendarEventRecord extends CalendarEvent {}

export interface AssignmentRecord extends TaskAssignment {
	task: {
		title: Task["title"];
		dueAt: Task["dueAt"];
		effortHours: Task["effortHours"];
	};
}

export interface SchedulingRepository {
	getTask(taskId: string): Effect.Effect<TaskRecord | null, SchedulingRepositoryError>;
	listPeople(): Effect.Effect<PersonRecord[], SchedulingRepositoryError>;
	getPersonEvents: (
		personId: string,
		start: Date,
		end: Date,
	) => Effect.Effect<CalendarEventRecord[], SchedulingRepositoryError>;
	getPersonAssignments: (
		personId: string,
		start: Date,
		end: Date,
	) => Effect.Effect<AssignmentRecord[], SchedulingRepositoryError>;
}

export const SchedulingRepository =
	Context.GenericTag<SchedulingRepository>("SchedulingRepository");
