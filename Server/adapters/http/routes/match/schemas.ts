import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const MatchRequestSchema = Schema.Struct({
	taskId: NonEmptyString,
});

const SkillMatchSchema = Schema.Struct({
	skillId: NonEmptyString,
	skillName: NonEmptyString,
	requiredLevel: Schema.optional(Schema.String),
	personLevel: Schema.optional(Schema.String),
	score: Schema.Number,
});

const MatchCandidateSchema = Schema.Struct({
	personId: NonEmptyString,
	personName: NonEmptyString,
	skillMatches: Schema.Array(SkillMatchSchema),
	skillScore: Schema.Number,
	capacityScore: Schema.Number,
	overallScore: Schema.Number,
});

export const MatchResponseSchema = Schema.Struct({
	taskId: NonEmptyString,
	candidates: Schema.Array(MatchCandidateSchema),
	bestMatch: Schema.optional(MatchCandidateSchema),
	justification: Schema.String,
	computedAt: Schema.String,
});

export type MatchRequest = Schema.Schema.Type<typeof MatchRequestSchema>;
export type MatchResponse = Schema.Schema.Type<typeof MatchResponseSchema>;
