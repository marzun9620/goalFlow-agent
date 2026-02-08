import { Data } from "effect";

export class LlmProviderError extends Data.TaggedError("LlmProviderError")<{
	message: string;
	cause?: unknown;
}> {}

export class GuardrailViolationError extends Data.TaggedError("GuardrailViolationError")<{
	issues: { type: string; span?: string }[];
}> {}

export class RateLimitExceededError extends Data.TaggedError("RateLimitExceededError")<{
	span?: string;
}> {}
