import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const DateString = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}/));

export const ScheduleRequestSchema = Schema.Struct({
	taskId: NonEmptyString,
	preferredDateRange: Schema.optional(
		Schema.Struct({
			start: DateString,
			end: DateString,
		}),
	),
	maxResults: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
});

export const TimeSlotSchema = Schema.Struct({
	start: NonEmptyString,
	end: NonEmptyString,
	personId: NonEmptyString,
	availabilityScore: Schema.Number,
});

export const ConflictSchema = Schema.Struct({
	personId: NonEmptyString,
	type: Schema.Literal("event", "assignment"),
	start: NonEmptyString,
	end: NonEmptyString,
	title: Schema.optional(Schema.String),
	source: Schema.optional(Schema.String),
	reason: Schema.optional(Schema.String),
});

export const ScheduleResponseSchema = Schema.Struct({
	taskId: NonEmptyString,
	proposedSlots: Schema.Array(TimeSlotSchema),
	recommendation: Schema.optional(TimeSlotSchema),
	conflicts: Schema.Array(ConflictSchema),
	computedAt: NonEmptyString,
});

export type ScheduleRequest = Schema.Schema.Type<typeof ScheduleRequestSchema>;
export type ScheduleResponse = Schema.Schema.Type<typeof ScheduleResponseSchema>;
