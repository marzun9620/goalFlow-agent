export type AgentMessageRole = "user" | "assistant" | "system";

export type AgentRunStatus = "proposed" | "approved" | "rejected" | "executed" | "failed";

export interface AgentProposal {
	mode: "proposal_only";
	summary: string;
	rawMessage: string;
	generatedAt: string;
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
