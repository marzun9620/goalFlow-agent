import { Data } from "effect";

export class MatchingRepositoryError extends Data.TaggedError("MatchingRepositoryError")<{
	operation: string;
	cause: unknown;
}> {}

export class MatchingFlowError extends Data.TaggedError("MatchingFlowError")<{
	operation: string;
	cause: unknown;
}> {}
