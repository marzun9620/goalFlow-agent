import { Effect, Layer } from "effect";
import OpenAI from "openai";
import type { LlmRequest, LlmResponse } from "../../domain/llm/types.js";
import { AppConfig } from "../../runtime/config.js";
import { LlmAdapter } from "./adapter.js";
import { LlmProviderError } from "./errors.js";

// GPT-4o-mini pricing (per 1M tokens): $0.15 input, $0.60 output
const INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.6 / 1_000_000;

const makeOpenAIAdapter = (apiKey: string): LlmAdapter => {
	const client = new OpenAI({ apiKey });

	return {
		complete: (request: LlmRequest) =>
			Effect.tryPromise({
				try: async () => {
					const response = await client.chat.completions.create({
						model: "gpt-4o-mini",
						messages: [{ role: "user", content: request.prompt }],
						max_tokens: request.maxTokens ?? 256,
						temperature: request.temperature ?? 0.7,
					});

					const choice = response.choices[0];
					const text = choice?.message?.content ?? "";
					const promptTokens = response.usage?.prompt_tokens ?? 0;
					const completionTokens = response.usage?.completion_tokens ?? 0;
					const totalTokens = response.usage?.total_tokens ?? 0;

					const approxCostUsd =
						promptTokens * INPUT_COST_PER_TOKEN + completionTokens * OUTPUT_COST_PER_TOKEN;

					return {
						text,
						usage: {
							promptTokens,
							completionTokens,
							totalTokens,
							approxCostUsd,
						},
					} satisfies LlmResponse;
				},
				catch: (cause) =>
					new LlmProviderError({
						message: `OpenAI API error: ${cause instanceof Error ? cause.message : String(cause)}`,
						cause,
					}),
			}),
	};
};

export const LlmAdapterOpenAILive = Layer.effect(
	LlmAdapter,
	Effect.map(AppConfig, (config) => {
		if (!config.openaiApiKey) {
			throw new Error("OPENAI_API_KEY is required for OpenAI adapter");
		}
		return makeOpenAIAdapter(config.openaiApiKey);
	}),
);
