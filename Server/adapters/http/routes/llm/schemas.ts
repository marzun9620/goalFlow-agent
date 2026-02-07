import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const JustifyRequestSchema = Schema.Struct({
	personName: NonEmptyString,
	taskTitle: NonEmptyString,
	capacityScore: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
	skillScore: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
});

export const JustifyResponseSchema = Schema.Struct({
	text: NonEmptyString,
	usage: Schema.Struct({
		promptTokens: Schema.Number,
		completionTokens: Schema.Number,
		totalTokens: Schema.Number,
		approxCostUsd: Schema.optional(Schema.Number),
	}),
});

export type JustifyRequest = Schema.Schema.Type<typeof JustifyRequestSchema>;
