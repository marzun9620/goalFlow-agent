import { Data } from "effect";

export class SchedulingRepositoryError extends Data.TaggedError("SchedulingRepositoryError")<{
	operation: string;
	cause: unknown;
}> {}

export class SchedulingFlowError extends Data.TaggedError("SchedulingFlowError")<{
	operation: string;
	cause: unknown;
}> {}

export class NoScheduleAvailableError extends Data.TaggedError("NoScheduleAvailableError")<{
	readonly taskId: string;
}> {}
