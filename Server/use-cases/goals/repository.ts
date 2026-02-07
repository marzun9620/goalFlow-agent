import type { Goal, Person, Task, TaskAssignment } from "@prisma/client";
import { Context, type Effect } from "effect";
import type { Milestone } from "../../domain/goals/types.js";
import type { GoalRepositoryError } from "./errors.js";

export interface GoalRecord extends Goal {
	milestones: Goal["milestones"];
}

export interface AssignmentRecord extends TaskAssignment {
	person: Pick<Person, "id" | "name">;
	task: Pick<Task, "id" | "title" | "dueAt" | "effortHours">;
}

export interface GoalRepository {
	createGoal: (input: {
		title: string;
		ownerId?: string | null;
		targetDate?: Date | null;
		status?: string | null;
	}) => Effect.Effect<GoalRecord, GoalRepositoryError>;
	getGoal: (id: string) => Effect.Effect<GoalRecord | null, GoalRepositoryError>;
	updateMilestones: (
		id: string,
		milestones: Milestone[],
	) => Effect.Effect<GoalRecord, GoalRepositoryError>;
	listAssignments: () => Effect.Effect<AssignmentRecord[], GoalRepositoryError>;
	listTasks: () => Effect.Effect<Task[], GoalRepositoryError>;
	listGoals: () => Effect.Effect<GoalRecord[], GoalRepositoryError>;
}

export const GoalRepository = Context.GenericTag<GoalRepository>("GoalRepository");
