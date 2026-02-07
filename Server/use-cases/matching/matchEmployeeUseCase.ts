import { Context, Effect, Layer } from "effect";
import { NoSuitableCandidateError, TaskNotFoundError } from "../../domain/matching/errors.js";
import type { MatchCandidate, MatchResult, SkillMatch } from "../../domain/matching/types.js";
import { MatchingFlowError } from "./errors.js";
import { MatchingRepository } from "./repository.js";

export interface MatchEmployeeUseCase {
	match: (
		taskId: string,
	) => Effect.Effect<MatchResult, MatchingFlowError | TaskNotFoundError | NoSuitableCandidateError>;
}

export const MatchEmployeeUseCase =
	Context.GenericTag<MatchEmployeeUseCase>("MatchEmployeeUseCase");

const LEVEL_ORDER = ["beginner", "junior", "intermediate", "mid", "senior", "expert", "principal"];

const normalizeLevel = (level?: string | null) => {
	if (!level) return 1;
	const numeric = Number(level);
	if (!Number.isNaN(numeric) && numeric > 0) return numeric;
	const idx = LEVEL_ORDER.indexOf(level.toLowerCase());
	return idx >= 0 ? idx + 1 : 1;
};

const computeSkillMatch = (
	required: { skillId: string; skillName: string; requiredLevel: string | null },
	candidateSkills: {
		skillId: string;
		skillName: string;
		level: string | null;
		years: number | null;
	}[],
): SkillMatch => {
	const found = candidateSkills.find((s) => s.skillId === required.skillId);
	if (!found) {
		return { ...required, personLevel: null, score: 0 };
	}

	const requiredLevelValue = normalizeLevel(required.requiredLevel);
	const personLevelValue = normalizeLevel(found.level);
	const levelRatio = personLevelValue / requiredLevelValue;
	const yearsBonus = Math.min(Math.max(found.years ?? 0, 0) * 0.02, 0.3);
	const score = Math.min(levelRatio + yearsBonus, 1.5);

	return {
		skillId: required.skillId,
		skillName: required.skillName,
		requiredLevel: required.requiredLevel,
		personLevel: found.level,
		score,
	};
};

const makeJustification = (best: MatchCandidate | undefined, taskId: string) => {
	if (!best) return `No suitable candidate found for task ${taskId}.`;
	return `Chose ${best.personName} based on skill fit (${best.skillScore.toFixed(2)}) and capacity (${best.capacityScore.toFixed(2)}).`;
};

const buildUseCase = (repo: MatchingRepository): MatchEmployeeUseCase => ({
	match: (taskId: string) =>
		Effect.gen(function* () {
			const task = yield* repo
				.getTask(taskId)
				.pipe(Effect.mapError((cause) => new MatchingFlowError({ operation: "getTask", cause })));

			if (!task) {
				return yield* Effect.fail(new TaskNotFoundError({ taskId }));
			}

			const candidates = yield* repo
				.listCandidates()
				.pipe(
					Effect.mapError((cause) => new MatchingFlowError({ operation: "listCandidates", cause })),
				);

			const requiredSkills = task.requiredSkills.map((r) => ({
				skillId: r.skillId,
				skillName: r.skill.name,
				requiredLevel: r.requiredLevel,
			}));

			const effortHours = task.effortHours ? Number(task.effortHours) : 1;

			const scoredCandidates: MatchCandidate[] = candidates.map((candidate) => {
				const skillMatches = requiredSkills.map((required) =>
					computeSkillMatch(required, candidate.skills),
				);
				const skillScore =
					requiredSkills.length === 0
						? 0
						: skillMatches.reduce((sum, m) => sum + m.score, 0) / requiredSkills.length;

				const available = (candidate.weeklyCapacityHours ?? 40) - (candidate.currentLoadHours ?? 0);
				const capacityScore = effortHours > 0 ? Math.max(0, available / effortHours) : 1;
				const overallScore = 0.7 * skillScore + 0.3 * capacityScore;

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

			const bestMatch = scoredCandidates[0];
			const result: MatchResult = {
				taskId,
				candidates: scoredCandidates,
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
		return buildUseCase(repo);
	}),
);
