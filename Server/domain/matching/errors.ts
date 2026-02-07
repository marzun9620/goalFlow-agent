import { Data } from "effect";

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	readonly taskId: string;
}> {}

export class NoSuitableCandidateError extends Data.TaggedError("NoSuitableCandidateError")<{
	readonly taskId: string;
}> {}
