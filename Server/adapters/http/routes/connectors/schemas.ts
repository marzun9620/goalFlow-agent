import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
export const DateString = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}/));

export const CalendarSyncRequestSchema = Schema.Struct({
	personId: NonEmptyString,
	start: NonEmptyString,
	end: NonEmptyString,
});

export const NotificationRequestSchema = Schema.Struct({
	channel: Schema.Literal("slack", "teams", "email"),
	target: NonEmptyString,
	message: NonEmptyString,
});

export const ProjectSyncRequestSchema = Schema.Struct({
	taskId: NonEmptyString,
	provider: Schema.Literal("jira", "notion", "trello"),
});

export type CalendarSyncRequest = Schema.Schema.Type<typeof CalendarSyncRequestSchema>;
export type NotificationRequest = Schema.Schema.Type<typeof NotificationRequestSchema>;
export type ProjectSyncRequest = Schema.Schema.Type<typeof ProjectSyncRequestSchema>;
