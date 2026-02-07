import type { Task } from "@prisma/client";
import { Context, type Effect } from "effect";
import type { MatchingRepositoryError } from "./errors.js";

export interface TaskWithRequirements extends Task {
	requiredSkills: {
		skillId: string;
		requiredLevel: string | null;
		priority: "REQUIRED" | "PREFERRED" | "BONUS";
		skill: { id: string; name: string };
	}[];
}

export interface CandidateRecord {
	personId: string;
	personName: string;
	weeklyCapacityHours: number | null;
	currentLoadHours: number;
	skills: {
		skillId: string;
		skillName: string;
		level: string | null;
		years: number | null;
	}[];
}

export interface CandidateFilter {
	hasAnySkills?: string[];
	minAvailableHours?: number;
	excludePersonIds?: string[];
}

export interface MatchingRepository {
	getTask(taskId: string): Effect.Effect<TaskWithRequirements | null, MatchingRepositoryError>;
	listCandidates(
		filter?: CandidateFilter,
	): Effect.Effect<CandidateRecord[], MatchingRepositoryError>;
}

export const MatchingRepository = Context.GenericTag<MatchingRepository>("MatchingRepository");
