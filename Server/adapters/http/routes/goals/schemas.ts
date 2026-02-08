import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
export const DateString = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}/));

export const CreateGoalRequestSchema = Schema.Struct({
	title: NonEmptyString,
	ownerId: Schema.optional(NonEmptyString),
	targetDate: Schema.optional(DateString),
	status: Schema.optional(Schema.String),
});

export const PlanGoalRequestSchema = Schema.Struct({
	numMilestones: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))),
});

export const MilestoneSchema = Schema.Struct({
	title: NonEmptyString,
	tasks: Schema.Array(NonEmptyString),
	targetDate: Schema.optional(Schema.String),
	status: Schema.Literal("pending", "in_progress", "completed"),
});

export const GoalSchema = Schema.Struct({
	id: NonEmptyString,
	title: NonEmptyString,
	ownerId: Schema.optional(Schema.String),
	targetDate: Schema.optional(Schema.String),
	status: Schema.optional(Schema.String),
	milestones: Schema.Array(MilestoneSchema),
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

export const PersonWorkloadSchema = Schema.Struct({
	personId: NonEmptyString,
	personName: NonEmptyString,
	allocatedHours: Schema.Number,
});

export const DeadlineItemSchema = Schema.Struct({
	taskId: NonEmptyString,
	title: NonEmptyString,
	dueAt: Schema.String,
});

export const GoalProgressSchema = Schema.Struct({
	goalId: NonEmptyString,
	title: NonEmptyString,
	progress: Schema.Number,
});

export const WorkloadSummarySchema = Schema.Struct({
	workloads: Schema.Array(PersonWorkloadSchema),
	upcomingDeadlines: Schema.Array(DeadlineItemSchema),
	goalProgress: Schema.Array(GoalProgressSchema),
	computedAt: Schema.String,
});

export type CreateGoalRequest = Schema.Schema.Type<typeof CreateGoalRequestSchema>;
export type PlanGoalRequest = Schema.Schema.Type<typeof PlanGoalRequestSchema>;
