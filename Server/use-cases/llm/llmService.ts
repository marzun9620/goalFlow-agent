import { Context, Effect, Layer } from "effect";
import type { LlmResponse } from "../../domain/llm/types.js";
import { LlmAdapter, LlmAdapterStubLive } from "./adapter.js";
import type {
	GuardrailViolationError,
	LlmProviderError,
	RateLimitExceededError,
} from "./errors.js";
import { Guardrails, GuardrailsLive } from "./guardrails.js";

export interface JustificationInput {
	personName: string;
	taskTitle: string;
	capacityScore: number;
	skillScore: number;
}

export interface LlmService {
	justifyMatch: (
		input: JustificationInput,
	) => Effect.Effect<
		LlmResponse,
		GuardrailViolationError | RateLimitExceededError | LlmProviderError
	>;
}

export const LlmService = Context.GenericTag<LlmService>("LlmService");

const buildPrompt = (input: JustificationInput) =>
	`Explain concisely why ${input.personName} is a good match for ${input.taskTitle}. Skill score ${input.skillScore.toFixed(2)}, capacity score ${input.capacityScore.toFixed(2)}. Respond in one sentence.`;

const makeService = (guardrails: Guardrails, adapter: LlmAdapter): LlmService => ({
	justifyMatch: (input: JustificationInput) =>
		Effect.gen(function* () {
			const prompt = buildPrompt(input);
			yield* guardrails.rateLimit("global");
			yield* guardrails.enforce(prompt);
			const response = yield* adapter.complete({
				prompt,
				maxTokens: 80,
				temperature: 0.2,
			});
			yield* guardrails.enforce(response.text);
			return response;
		}),
});

export const LlmServiceLive = Layer.effect(
	LlmService,
	Effect.gen(function* () {
		const guardrails = yield* Guardrails;
		const adapter = yield* LlmAdapter;
		return makeService(guardrails, adapter);
	}),
);

export const LlmServicesLive = Layer.mergeAll(GuardrailsLive, LlmAdapterStubLive, LlmServiceLive);
