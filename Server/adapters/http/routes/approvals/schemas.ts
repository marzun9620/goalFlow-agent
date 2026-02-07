import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const CreateApprovalRequestSchema = Schema.Struct({
	requesterId: NonEmptyString,
	targetId: NonEmptyString,
	reason: Schema.optional(Schema.String),
});

export const UpdateApprovalRequestSchema = Schema.Struct({
	status: Schema.Literal("approved", "rejected"),
});

export type CreateApprovalRequest = Schema.Schema.Type<typeof CreateApprovalRequestSchema>;
export type UpdateApprovalRequest = Schema.Schema.Type<typeof UpdateApprovalRequestSchema>;
