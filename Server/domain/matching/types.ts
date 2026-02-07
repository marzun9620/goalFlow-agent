export type SkillMatch = {
	skillId: string;
	skillName: string;
	requiredLevel?: string | null;
	personLevel?: string | null;
	score: number;
};

export type MatchCandidate = {
	personId: string;
	personName: string;
	skillMatches: SkillMatch[];
	skillScore: number;
	capacityScore: number;
	overallScore: number;
};

export type MatchResult = {
	taskId: string;
	candidates: MatchCandidate[];
	bestMatch?: MatchCandidate;
	justification: string;
	computedAt: string;
};
