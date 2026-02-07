import { Decimal } from "@prisma/client/runtime/library";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
	MatchEmployeeUseCaseLive,
	MatchingConfigLive,
	defaultMatchingConfig,
} from "./matchEmployeeUseCase.js";
import {
	type CandidateRecord,
	MatchingRepository,
	type TaskWithRequirements,
} from "./repository.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const createTask = (overrides: Partial<TaskWithRequirements> = {}): TaskWithRequirements => ({
	id: "task-1",
	title: "Test Task",
	description: null,
	priority: null,
	effortHours: new Decimal(10),
	dueAt: null,
	ownerId: null,
	sensitivityLevel: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	requiredSkills: [
		{
			skillId: "skill-ts",
			requiredLevel: "senior", // Level 5
			priority: "REQUIRED",
			skill: { id: "skill-ts", name: "TypeScript" },
		},
	],
	...overrides,
});

const createCandidate = (overrides: Partial<CandidateRecord> = {}): CandidateRecord => ({
	personId: "person-1",
	personName: "Test Person",
	weeklyCapacityHours: 40,
	currentLoadHours: 0,
	skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "senior", years: 3 }],
	...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock Repository Layer
// ─────────────────────────────────────────────────────────────────────────────

const createMockRepoLayer = (
	task: TaskWithRequirements | null,
	candidates: CandidateRecord[],
	capture?: { filter?: unknown },
) =>
	Layer.succeed(MatchingRepository, {
		getTask: () => Effect.succeed(task),
		listCandidates: (filter?: unknown) => {
			if (capture) capture.filter = filter;
			return Effect.succeed(candidates);
		},
	});

const runMatch = async (
	task: TaskWithRequirements | null,
	candidates: CandidateRecord[],
	options?: { limit?: number; skillWeight?: number; capacityWeight?: number },
	captureFilter?: { filter?: unknown },
) => {
	const testLayer = Layer.provideMerge(
		MatchEmployeeUseCaseLive,
		Layer.merge(createMockRepoLayer(task, candidates, captureFilter), MatchingConfigLive),
	);

	const { MatchEmployeeUseCase } = await import("./matchEmployeeUseCase.js");

	return Effect.runPromise(
		Effect.gen(function* () {
			const useCase = yield* MatchEmployeeUseCase;
			return yield* useCase.match("task-1", options);
		}).pipe(Effect.provide(testLayer)),
	);
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("MatchEmployeeUseCase", () => {
	describe("capacity score capping", () => {
		it("caps capacity score at 1.0 when availability exceeds effort", async () => {
			// 40 available hours / 5 effort = 8, should cap at 1.0
			const task = createTask({ effortHours: new Decimal(5) });
			const candidate = createCandidate({ currentLoadHours: 0 }); // 40 available

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.capacityScore).toBe(1.0);
		});

		it("calculates correct capacity score when availability is less than effort", async () => {
			// 10 available hours / 20 effort = 0.5
			const task = createTask({ effortHours: new Decimal(20) });
			const candidate = createCandidate({ currentLoadHours: 30 }); // 10 available

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.capacityScore).toBe(0.5);
		});

		it("returns 0 capacity score when no availability", async () => {
			const task = createTask({ effortHours: new Decimal(10) });
			const candidate = createCandidate({ currentLoadHours: 40 }); // 0 available

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.capacityScore).toBe(0);
		});
	});

	describe("skill score capping", () => {
		it("caps skill score at 1.0 when person level exceeds required", async () => {
			// Expert (6) > Senior (5), but capped at 1.0
			const task = createTask();
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "expert", years: 0 }],
			});

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.skillScore).toBeLessThanOrEqual(1.0);
		});

		it("includes years bonus up to 0.2", async () => {
			// Senior matches Senior = 1.0, + 10 years * 0.02 = 0.2 bonus, but capped at 1.0
			const task = createTask();
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "senior", years: 10 }],
			});

			const result = await runMatch(task, [candidate]);

			// Score should include years bonus but still capped at 1.0
			expect(result.bestMatch?.skillScore).toBe(1.0);
		});
	});

	describe("missing skill penalty", () => {
		it("applies configurable penalty for missing skills", async () => {
			const task = createTask();
			const candidate = createCandidate({ skills: [] }); // No TypeScript skill

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.skillMatches[0].score).toBe(
				defaultMatchingConfig.missingSkillPenalty,
			);
			expect(result.bestMatch?.skillScore).toBe(defaultMatchingConfig.missingSkillPenalty);
		});
	});

	describe("limit parameter", () => {
		it("returns only top N candidates when limit is specified", async () => {
			const task = createTask();
			const candidates = [
				createCandidate({ personId: "p1", personName: "Alice" }),
				createCandidate({ personId: "p2", personName: "Bob" }),
				createCandidate({ personId: "p3", personName: "Carol" }),
			];

			const result = await runMatch(task, candidates, { limit: 2 });

			expect(result.candidates.length).toBe(2);
		});

		it("returns all candidates when limit exceeds candidate count", async () => {
			const task = createTask();
			const candidates = [createCandidate({ personId: "p1", personName: "Alice" })];

			const result = await runMatch(task, candidates, { limit: 10 });

			expect(result.candidates.length).toBe(1);
		});
	});

	describe("configurable weights", () => {
		it("uses custom skill weight", async () => {
			const task = createTask();
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "senior", years: 0 }],
				currentLoadHours: 20, // 50% capacity
			});

			// With 100% skill weight, overall = skill score
			const result = await runMatch(task, [candidate], { skillWeight: 1.0, capacityWeight: 0.0 });

			expect(result.bestMatch?.overallScore).toBeCloseTo(result.bestMatch?.skillScore ?? 0, 5);
		});

		it("uses custom capacity weight", async () => {
			const task = createTask();
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "senior", years: 0 }],
				currentLoadHours: 30, // 25% capacity (10/40)
			});

			// With 100% capacity weight, overall = capacity score
			const result = await runMatch(task, [candidate], { skillWeight: 0.0, capacityWeight: 1.0 });

			expect(result.bestMatch?.overallScore).toBeCloseTo(result.bestMatch?.capacityScore ?? 0, 5);
		});
	});

	describe("skill priority weighting", () => {
		it("weights REQUIRED higher than BONUS when computing skillScore", async () => {
			const task = createTask({
				requiredSkills: [
					{
						skillId: "skill-ts",
						requiredLevel: "SENIOR",
						priority: "REQUIRED",
						skill: { id: "skill-ts", name: "TypeScript" },
					},
					{
						skillId: "skill-llm",
						requiredLevel: "MID",
						priority: "BONUS",
						skill: { id: "skill-llm", name: "LLM" },
					},
				],
			});
			const candidate = createCandidate({
				skills: [
					{ skillId: "skill-ts", skillName: "TypeScript", level: "SENIOR", years: 3 },
					// Missing bonus skill
				],
			});

			const result = await runMatch(task, [candidate]);

			// REQUIRED match should dominate despite missing bonus skill
			expect(result.bestMatch?.skillScore).toBeGreaterThan(0.75);
		});
	});

	describe("repository pre-filter arguments", () => {
		it("passes skill ids and effort as filter inputs", async () => {
			const capture: { filter?: unknown } = {};
			const task = createTask({
				effortHours: new Decimal(8),
				requiredSkills: [
					{
						skillId: "skill-ts",
						requiredLevel: "SENIOR",
						priority: "REQUIRED",
						skill: { id: "skill-ts", name: "TypeScript" },
					},
				],
			});

			const candidate = createCandidate();

			await runMatch(task, [candidate], undefined, capture);

			expect(capture.filter).toEqual({
				hasAnySkills: ["skill-ts"],
				minAvailableHours: 8,
			});
		});
	});

	describe("ranking", () => {
		it("ranks candidates by overall score descending", async () => {
			const task = createTask();
			const candidates = [
				createCandidate({
					personId: "low",
					personName: "Low",
					skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "junior", years: 0 }],
					currentLoadHours: 35,
				}),
				createCandidate({
					personId: "high",
					personName: "High",
					skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "expert", years: 5 }],
					currentLoadHours: 0,
				}),
			];

			const result = await runMatch(task, candidates);

			expect(result.candidates[0].personName).toBe("High");
			expect(result.candidates[1].personName).toBe("Low");
		});

		it("breaks ties alphabetically by name", async () => {
			const task = createTask();
			const candidates = [
				createCandidate({ personId: "z", personName: "Zoe" }),
				createCandidate({ personId: "a", personName: "Alice" }),
			];

			const result = await runMatch(task, candidates);

			// Same scores, should be alphabetical
			expect(result.candidates[0].personName).toBe("Alice");
			expect(result.candidates[1].personName).toBe("Zoe");
		});
	});

	describe("level normalization", () => {
		it("handles string levels correctly", async () => {
			const levels = ["beginner", "junior", "intermediate", "mid", "senior", "expert", "principal"];

			for (let i = 0; i < levels.length; i++) {
				const task = createTask({
					requiredSkills: [
						{
							skillId: "skill-ts",
							requiredLevel: levels[i],
							priority: "REQUIRED",
							skill: { id: "skill-ts", name: "TypeScript" },
						},
					],
				});
				const candidate = createCandidate({
					skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: levels[i], years: 0 }],
				});

				const result = await runMatch(task, [candidate]);

				// Same level should give score of 1.0
				expect(result.bestMatch?.skillScore).toBe(1.0);
			}
		});

		it("handles numeric string levels", async () => {
			const task = createTask({
				requiredSkills: [
					{
						skillId: "skill-ts",
						requiredLevel: "3",
						priority: "REQUIRED",
						skill: { id: "skill-ts", name: "TypeScript" },
					},
				],
			});
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: "3", years: 0 }],
			});

			const result = await runMatch(task, [candidate]);

			expect(result.bestMatch?.skillScore).toBe(1.0);
		});

		it("defaults to 1 for null/undefined levels", async () => {
			const task = createTask({
				requiredSkills: [
					{
						skillId: "skill-ts",
						requiredLevel: null,
						priority: "REQUIRED",
						skill: { id: "skill-ts", name: "TypeScript" },
					},
				],
			});
			const candidate = createCandidate({
				skills: [{ skillId: "skill-ts", skillName: "TypeScript", level: null, years: 0 }],
			});

			const result = await runMatch(task, [candidate]);

			// null/null = 1/1 = 1.0
			expect(result.bestMatch?.skillScore).toBe(1.0);
		});
	});
});
