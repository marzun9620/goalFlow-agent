import { Data } from "effect";

export class AgentRepositoryError extends Data.TaggedError("AgentRepositoryError")<{
	operation: string;
	cause: unknown;
}> {}

export class AgentConversationNotFoundError extends Data.TaggedError(
	"AgentConversationNotFoundError",
)<{
	conversationId: string;
}> {}

export class AgentChatError extends Data.TaggedError("AgentChatError")<{
	reason: string;
	cause?: unknown;
}> {}

export class AgentRunNotFoundError extends Data.TaggedError("AgentRunNotFoundError")<{
	runId: string;
}> {}

export class AgentRunConflictError extends Data.TaggedError("AgentRunConflictError")<{
	runId: string;
	reason: string;
}> {}

export class AgentRunValidationError extends Data.TaggedError("AgentRunValidationError")<{
	runId: string;
	reason: string;
}> {}
