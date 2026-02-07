import { Data } from "effect";

export class GoalRepositoryError extends Data.TaggedError("GoalRepositoryError")<{
	operation: string;
	cause: unknown;
}> {}

export class GoalNotFoundError extends Data.TaggedError("GoalNotFoundError")<{
	goalId: string;
}> {}

export class GoalPlanningError extends Data.TaggedError("GoalPlanningError")<{
	goalId: string;
	cause?: unknown;
}> {}
