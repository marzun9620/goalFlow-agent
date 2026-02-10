import type {
	AgentDistributionMode,
	AgentMemberSkillIntent,
	AgentProjectIntent,
	AgentSkillLevel,
} from "../../domain/agent/types.js";

export interface ParsedMemberDraft {
	name: string;
	weeklyCapacityHours: number | null;
	skills: AgentMemberSkillIntent[];
}

export interface ParsedIntentDraft {
	project: AgentProjectIntent | null;
	tasks: string[];
	members: ParsedMemberDraft[];
	distributionMode: AgentDistributionMode | null;
}

const LEVEL_ALIASES: Record<string, AgentSkillLevel> = {
	beginner: "beginner",
	junior: "junior",
	intermediate: "intermediate",
	mid: "mid",
	senior: "senior",
	expert: "expert",
	principal: "principal",
	sr: "senior",
	snr: "senior",
};

const LEVEL_PATTERNS = Object.keys(LEVEL_ALIASES).sort((a, b) => b.length - a.length);

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

const dequote = (value: string) => value.replace(/^["'`]+|["'`]+$/g, "").trim();

const dedupe = (values: string[]) => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = value.toLowerCase();
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(value);
	}
	return result;
};

const splitOutsideParens = (input: string, separators: string[] = [",", "/", ";"]) => {
	const parts: string[] = [];
	let current = "";
	let depth = 0;

	for (let i = 0; i < input.length; i += 1) {
		const ch = input[i];
		if (ch === "(") depth += 1;
		if (ch === ")") depth = Math.max(0, depth - 1);

		if (depth === 0 && separators.includes(ch)) {
			if (current.trim()) parts.push(current.trim());
			current = "";
			continue;
		}

		current += ch;
	}

	if (current.trim()) parts.push(current.trim());
	return parts;
};

const parseYears = (input: string): number | null => {
	const match = input.match(/\b(\d{1,3})\s*(?:y|yr|yrs|year|years)\b/i);
	if (!match) return null;
	const parsed = Number.parseInt(match[1], 10);
	return Number.isFinite(parsed) ? parsed : null;
};

const parseLevel = (input: string): AgentSkillLevel | null => {
	const lower = input.toLowerCase();
	for (const key of LEVEL_PATTERNS) {
		const regex = new RegExp(`\\b${key}\\b`, "i");
		if (regex.test(lower)) {
			return LEVEL_ALIASES[key] ?? null;
		}
	}
	return null;
};

const removeLevelAndYears = (input: string) => {
	let cleaned = input;
	cleaned = cleaned.replace(/\b\d{1,3}\s*(?:y|yr|yrs|year|years)\b/gi, "");
	for (const key of LEVEL_PATTERNS) {
		const regex = new RegExp(`\\b${key}\\b`, "gi");
		cleaned = cleaned.replace(regex, "");
	}
	return cleaned
		.replace(/\b(skills?|with|at|level)\b/gi, "")
		.replace(/\s+/g, " ")
		.trim();
};

const parseSkillEntries = (raw: string): AgentMemberSkillIntent[] => {
	const segments = splitOutsideParens(raw.replace(/\band\b/gi, ","));
	const skills: AgentMemberSkillIntent[] = [];
	for (const segment of segments) {
		const candidate = normalize(segment);
		if (!candidate) continue;
		const level = parseLevel(candidate);
		const years = parseYears(candidate);
		const skillName = dequote(removeLevelAndYears(candidate)).replace(/^[:-]\s*/, "");
		if (!skillName) continue;
		skills.push({
			name: skillName,
			level,
			years,
		});
	}
	return skills;
};

const parseMemberToken = (token: string): ParsedMemberDraft | null => {
	const normalized = normalize(token);
	if (!normalized) return null;

	const parenMatch = normalized.match(/^(.+?)\s*\((.+)\)$/);
	const colonIdx = normalized.indexOf(":");
	const hasColon = colonIdx > 0;

	let rawName = normalized;
	let rawSkillDetails = "";
	if (parenMatch) {
		rawName = normalize(parenMatch[1]);
		rawSkillDetails = normalize(parenMatch[2]);
	} else if (hasColon) {
		rawName = normalize(normalized.slice(0, colonIdx));
		rawSkillDetails = normalize(normalized.slice(colonIdx + 1));
	}

	const capacityMatch = normalized.match(
		/\b(\d{1,2})\s*(?:h|hr|hrs|hour|hours)(?:\s*\/?\s*w(?:eek)?)?\b/i,
	);
	const weeklyCapacityHours = capacityMatch ? Number.parseInt(capacityMatch[1], 10) : null;

	const name = dequote(
		rawName
			.replace(/\b(include|add|member|members|people|team|and|with)\b/gi, " ")
			.replace(/\b\d{1,2}\s*(?:h|hr|hrs|hour|hours)(?:\s*\/?\s*w(?:eek)?)?\b/gi, " "),
	).trim();
	if (!name) return null;

	const skills = rawSkillDetails ? parseSkillEntries(rawSkillDetails) : [];
	return {
		name,
		weeklyCapacityHours: Number.isFinite(weeklyCapacityHours ?? Number.NaN)
			? weeklyCapacityHours
			: null,
		skills,
	};
};

const parseProject = (segments: string[]): AgentProjectIntent | null => {
	for (const segment of segments) {
		const normalized = normalize(segment);
		const createMatch = normalized.match(/\bnew project\b[:\s-]*(.+)$/i);
		if (createMatch) {
			const name = dequote(
				createMatch[1].split(/\b(?:add tasks?|include|with|distribute)\b/i)[0] ?? "",
			);
			if (name) return { mode: "create", name: normalize(name) };
		}
		const updateMatch = normalized.match(/\bproject\b[:\s-]*(.+)$/i);
		if (updateMatch) {
			const name = dequote(
				updateMatch[1].split(/\b(?:add tasks?|include|with|distribute)\b/i)[0] ?? "",
			);
			if (name) return { mode: "update", name: normalize(name) };
		}
	}
	return null;
};

const parseTasks = (segments: string[]): string[] => {
	const tasks: string[] = [];
	for (const segment of segments) {
		if (!/\btasks?\b/i.test(segment)) continue;
		const tail = segment.replace(/^.*?\btasks?\b[:\s-]*/i, "").trim();
		if (!tail) continue;
		for (const part of splitOutsideParens(tail.replace(/\band\b/gi, ","))) {
			const task = dequote(part);
			if (task) tasks.push(normalize(task));
		}
	}
	return dedupe(tasks);
};

const parseMembers = (segments: string[]): ParsedMemberDraft[] => {
	const members: ParsedMemberDraft[] = [];
	for (const segment of segments) {
		if (!/\b(include|members?|people|team)\b/i.test(segment)) continue;
		const tail = segment
			.replace(/^.*?\b(include|members?|people|team)\b[:\s-]*/i, "")
			.replace(/\bdistribut(?:e|ion)\b.*$/i, "")
			.trim();
		if (!tail) continue;

		const candidates = splitOutsideParens(tail.replace(/\band\b/gi, ","));
		for (const candidate of candidates) {
			const parsed = parseMemberToken(candidate);
			if (parsed) members.push(parsed);
		}
	}

	const deduped = new Map<string, ParsedMemberDraft>();
	for (const member of members) {
		const key = member.name.toLowerCase();
		const existing = deduped.get(key);
		if (!existing) {
			deduped.set(key, member);
			continue;
		}
		const weeklyCapacityHours = existing.weeklyCapacityHours ?? member.weeklyCapacityHours;
		const skills = [...existing.skills, ...member.skills];
		deduped.set(key, {
			name: existing.name,
			weeklyCapacityHours,
			skills: dedupe(
				skills.map(
					(skill) => `${skill.name.toLowerCase()}|${skill.level ?? ""}|${skill.years ?? ""}`,
				),
			).map((keyed) => {
				const [name, level, years] = keyed.split("|");
				return {
					name,
					level: (level || null) as AgentSkillLevel | null,
					years: years ? Number.parseInt(years, 10) : null,
				};
			}),
		});
	}

	return [...deduped.values()];
};

const parseDistributionMode = (message: string): AgentDistributionMode | null =>
	/\b(capacity|available hours?|workload)\b/i.test(message) ? "capacity" : null;

export const parseIntentDraft = (message: string): ParsedIntentDraft => {
	const normalized = normalize(message);
	const segments = normalized.split(/[\n,]+/).map((segment) => segment.trim());
	return {
		project: parseProject(segments),
		tasks: parseTasks(segments),
		members: parseMembers(segments),
		distributionMode: parseDistributionMode(normalized),
	};
};
