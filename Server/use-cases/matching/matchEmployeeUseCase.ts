import { Context, Effect, Layer } from "effect";
import { NoSuitableCandidateError, TaskNotFoundError } from "../../domain/matching/errors.js";
import type { MatchCandidate, MatchResult, SkillMatch } from "../../domain/matching/types.js";
import { MatchingFlowError } from "./errors.js";
import { MatchingRepository } from "./repository.js";

// ─────────────────────────────────────────────────────────────────────────────
// Matching Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchingConfig {
	/** Weight for skill score (0-1), default 0.7 */
	skillWeight: number;
	/** Weight for capacity score (0-1), default 0.3 */
	capacityWeight: number;
	/** Maximum candidates to return, default 10 */
	maxCandidates: number;
	/** Score for missing skills (0-1), default 0.1 */
	missingSkillPenalty: number;
}

export const MatchingConfig = Context.GenericTag<MatchingConfig>("MatchingConfig");

export const defaultMatchingConfig: MatchingConfig = {
	skillWeight: 0.7,
	capacityWeight: 0.3,
	maxCandidates: 10,
	missingSkillPenalty: 0.1,
};

export const MatchingConfigLive = Layer.succeed(MatchingConfig, defaultMatchingConfig);

// ─────────────────────────────────────────────────────────────────────────────
// Match Options (per-request overrides)
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchOptions {
	/** Override max candidates for this request */
	limit?: number;
	/** Override skill weight for this request */
	skillWeight?: number;
	/** Override capacity weight for this request */
	capacityWeight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Use Case Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchEmployeeUseCase {
	match: (
		taskId: string,
		options?: MatchOptions,
	) => Effect.Effect<MatchResult, MatchingFlowError | TaskNotFoundError | NoSuitableCandidateError>;
}

export const MatchEmployeeUseCase =
	Context.GenericTag<MatchEmployeeUseCase>("MatchEmployeeUseCase");

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_ORDER = ["beginner", "junior", "intermediate", "mid", "senior", "expert", "principal"];
const MAX_LEVEL = LEVEL_ORDER.length; // 7

const normalizeLevel = (level?: string | null): number => {
	if (!level) return 1;
	const numeric = Number(level);
	if (!Number.isNaN(numeric) && numeric > 0) return numeric;
	const idx = LEVEL_ORDER.indexOf(level.toLowerCase());
	return idx >= 0 ? idx + 1 : 1;
};

const PRIORITY_WEIGHTS: Record<"REQUIRED" | "PREFERRED" | "BONUS", number> = {
	REQUIRED: 1,
	PREFERRED: 0.6,
	BONUS: 0.3,
};

const computeSkillMatch = (
	required: {
		skillId: string;
		skillName: string;
		requiredLevel: string | null;
		priority: "REQUIRED" | "PREFERRED" | "BONUS";
	},
	candidateSkills: {
		skillId: string;
		skillName: string;
		level: string | null;
		years: number | null;
	}[],
	missingSkillPenalty: number,
): SkillMatch => {
	const found = candidateSkills.find((s) => s.skillId === required.skillId);
	if (!found) {
		// Use configurable penalty instead of 0
		return {
			...required,
			personLevel: null,
			priority: required.priority,
			score: missingSkillPenalty,
		};
	}

	const requiredLevelValue = normalizeLevel(required.requiredLevel);
	const personLevelValue = normalizeLevel(found.level);

	// Normalize to 0-1 range: personLevel / maxLevel, scaled by requirement
	const levelRatio = Math.min(personLevelValue / requiredLevelValue, 1);
	const yearsBonus = Math.min(Math.max(found.years ?? 0, 0) * 0.02, 0.2);
	// Cap at 1.0 (was 1.5)
	const score = Math.min(levelRatio + yearsBonus, 1.0);

	return {
		skillId: required.skillId,
		skillName: required.skillName,
		requiredLevel: required.requiredLevel,
		personLevel: found.level,
		priority: required.priority,
		score,
	};
};

const makeJustification = (best: MatchCandidate | undefined, taskId: string) => {
	if (!best) return `No suitable candidate found for task ${taskId}.`;
	return `Chose ${best.personName} based on skill fit (${best.skillScore.toFixed(2)}) and capacity (${best.capacityScore.toFixed(2)}).`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Use Case Implementation
// ─────────────────────────────────────────────────────────────────────────────

const buildUseCase = (repo: MatchingRepository, config: MatchingConfig): MatchEmployeeUseCase => ({
	match: (taskId: string, options?: MatchOptions) =>
		Effect.gen(function* () {
			// Merge config with per-request options
			const skillWeight = options?.skillWeight ?? config.skillWeight;
			const capacityWeight = options?.capacityWeight ?? config.capacityWeight;
			const maxCandidates = options?.limit ?? config.maxCandidates;

			const task = yield* repo
				.getTask(taskId)
				.pipe(Effect.mapError((cause) => new MatchingFlowError({ operation: "getTask", cause })));

			if (!task) {
				return yield* Effect.fail(new TaskNotFoundError({ taskId }));
			}

			const requiredSkills = task.requiredSkills.map((r) => ({
				skillId: r.skillId,
				skillName: r.skill.name,
				requiredLevel: r.requiredLevel,
				priority: r.priority ?? "REQUIRED",
			}));

			const effortHours = task.effortHours ? Number(task.effortHours) : 1;

			const candidates = yield* repo
				.listCandidates({
					hasAnySkills: requiredSkills.map((r) => r.skillId),
					minAvailableHours: effortHours > 0 ? effortHours : undefined,
				})
				.pipe(
					Effect.mapError((cause) => new MatchingFlowError({ operation: "listCandidates", cause })),
				);

			const scoredCandidates: MatchCandidate[] = candidates.map((candidate) => {
				const skillMatches = requiredSkills.map((required) =>
					computeSkillMatch(required, candidate.skills, config.missingSkillPenalty),
				);
				const totalPriorityWeight = skillMatches.reduce(
					(sum, m) =>
						sum + PRIORITY_WEIGHTS[(m.priority ?? "REQUIRED") as keyof typeof PRIORITY_WEIGHTS],
					0,
				);
				const skillScore =
					requiredSkills.length === 0 || totalPriorityWeight === 0
						? 0
						: skillMatches.reduce(
								(sum, m) =>
									sum +
									m.score *
										PRIORITY_WEIGHTS[(m.priority ?? "REQUIRED") as keyof typeof PRIORITY_WEIGHTS],
								0,
							) / totalPriorityWeight;

				const available = (candidate.weeklyCapacityHours ?? 40) - (candidate.currentLoadHours ?? 0);
				// Cap capacity score at 1.0 (was unbounded)
				const capacityScore =
					effortHours > 0 ? Math.min(1, Math.max(0, available / effortHours)) : 1;
				// Use configurable weights
				const overallScore = skillWeight * skillScore + capacityWeight * capacityScore;

				return {
					personId: candidate.personId,
					personName: candidate.personName,
					skillMatches,
					skillScore,
					capacityScore,
					overallScore,
				};
			});

			if (scoredCandidates.length === 0) {
				return yield* Effect.fail(new NoSuitableCandidateError({ taskId }));
			}

			scoredCandidates.sort((a, b) => {
				if (b.overallScore === a.overallScore) {
					return a.personName.localeCompare(b.personName);
				}
				return b.overallScore - a.overallScore;
			});

			// Apply limit to return only top N candidates
			const limitedCandidates = scoredCandidates.slice(0, maxCandidates);
			const bestMatch = limitedCandidates[0];

			const result: MatchResult = {
				taskId,
				candidates: limitedCandidates,
				bestMatch,
				justification: makeJustification(bestMatch, taskId),
				computedAt: new Date().toISOString(),
			};

			return result;
		}),
});

export const MatchEmployeeUseCaseLive = Layer.effect(
	MatchEmployeeUseCase,
	Effect.gen(function* () {
		const repo = yield* MatchingRepository;
		const config = yield* MatchingConfig;
		return buildUseCase(repo, config);
	}),
);
