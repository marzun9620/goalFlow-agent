import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const AgentChatRequestSchema = Schema.Struct({
	message: NonEmptyString,
	conversationId: Schema.optional(NonEmptyString),
});

export type AgentChatRequest = Schema.Schema.Type<typeof AgentChatRequestSchema>;
