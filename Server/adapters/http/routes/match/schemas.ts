import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const MatchRequestSchema = Schema.Struct({
	taskId: NonEmptyString,
	/** Maximum number of candidates to return (default: 10) */
	limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
	/** Override skill weight (0-1) for this request */
	skillWeight: Schema.optional(
		Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
	),
	/** Override capacity weight (0-1) for this request */
	capacityWeight: Schema.optional(
		Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
	),
});

const SkillMatchSchema = Schema.Struct({
	skillId: NonEmptyString,
	skillName: NonEmptyString,
	requiredLevel: Schema.optional(Schema.String),
	personLevel: Schema.optional(Schema.String),
	priority: Schema.optional(Schema.Literal("REQUIRED", "PREFERRED", "BONUS")),
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
