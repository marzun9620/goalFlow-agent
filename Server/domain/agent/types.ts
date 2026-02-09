export type AgentMessageRole = "user" | "assistant" | "system";

export type AgentRunStatus = "proposed" | "approved" | "rejected" | "executed" | "failed";

export type AgentDistributionMode = "capacity";

export type AgentSkillLevel =
	| "beginner"
	| "junior"
	| "intermediate"
	| "mid"
	| "senior"
	| "expert"
	| "principal";

export interface AgentProjectIntent {
	mode: "create" | "update";
	name: string;
}

export interface AgentMemberSkillIntent {
	name: string;
	level: AgentSkillLevel | null;
	years: number | null;
}

export interface AgentMemberIntent {
	name: string;
	resolution: "existing" | "new" | "ambiguous";
	existingPersonId: string | null;
	candidateMatches: Array<{ id: string; name: string }>;
	weeklyCapacityHours: number | null;
	skills: AgentMemberSkillIntent[];
}

export interface AgentIntentPayload {
	project: AgentProjectIntent | null;
	tasks: string[];
	members: AgentMemberIntent[];
	distributionMode: AgentDistributionMode | null;
	followUps: string[];
}

export interface AgentProposal {
	mode: "proposal_only";
	summary: string;
	rawMessage: string;
	generatedAt: string;
	intent: AgentIntentPayload;
	actions: Array<{
		type: string;
		description: string;
	}>;
}

export interface AgentChatResult {
	conversationId: string;
	runId: string;
	proposal: AgentProposal;
}
