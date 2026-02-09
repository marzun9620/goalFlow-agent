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
