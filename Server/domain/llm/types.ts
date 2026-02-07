export type LlmProvider = "stub";

export type LlmRequest = {
	provider?: LlmProvider;
	prompt: string;
	maxTokens?: number;
	temperature?: number;
};

export type LlmResponse = {
	text: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
		approxCostUsd?: number;
	};
};

export type GuardrailIssue =
	| { type: "pii"; span: string }
	| { type: "toxicity"; span: string }
	| { type: "rate_limit"; span?: string };

export type GuardrailResult = {
	passed: boolean;
	issues: GuardrailIssue[];
};
