import { Context, Effect, Layer } from "effect";
import type { LlmRequest, LlmResponse } from "../../domain/llm/types.js";
import { LlmProviderError } from "./errors.js";

export interface LlmAdapter {
	complete: (request: LlmRequest) => Effect.Effect<LlmResponse, LlmProviderError>;
}

export const LlmAdapter = Context.GenericTag<LlmAdapter>("LlmAdapter");

const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

const stubComplete = (request: LlmRequest): LlmResponse => {
	const text = `Because ${request.prompt.slice(0, 120)}`; // deterministic stub
	const promptTokens = estimateTokens(request.prompt);
	const completionTokens = estimateTokens(text);
	return {
		text,
		usage: {
			promptTokens,
			completionTokens,
			totalTokens: promptTokens + completionTokens,
			approxCostUsd: ((promptTokens + completionTokens) / 1000) * 0.0004,
		},
	};
};

const makeStubAdapter = (): LlmAdapter => ({
	complete: (request: LlmRequest) =>
		Effect.try({
			try: () => stubComplete(request),
			catch: (cause) =>
				new LlmProviderError({
					message: "Failed to generate completion",
					cause,
				}),
		}),
});

export const LlmAdapterStubLive = Layer.succeed(LlmAdapter, makeStubAdapter());
