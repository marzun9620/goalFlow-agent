import { Context, Effect, Layer, Ref } from "effect";
import type { GuardrailIssue, GuardrailResult } from "../../domain/llm/types.js";
import { GuardrailViolationError, RateLimitExceededError } from "./errors.js";

export interface GuardrailConfig {
	maxRequestsPerMinute: number;
}

export interface Guardrails {
	check: (text: string) => Effect.Effect<GuardrailResult, never>;
	enforce: (text: string) => Effect.Effect<void, GuardrailViolationError>;
	rateLimit: (key: string) => Effect.Effect<void, RateLimitExceededError>;
}

export const Guardrails = Context.GenericTag<Guardrails>("Guardrails");

const defaultConfig: GuardrailConfig = {
	maxRequestsPerMinute: 60,
};

const piiRegex =
	/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\\b\\d{3}[-\\. ]?\\d{3}[-\\. ]?\\d{4}\\b)/iu;
const toxicWords = ["hate", "kill"];

const makeGuardrails = (config: GuardrailConfig): Effect.Effect<Guardrails> =>
	Effect.gen(function* () {
		const counters = yield* Ref.make(new Map<string, { count: number; window: number }>());

		const check = (text: string): GuardrailResult => {
			const issues: GuardrailIssue[] = [];
			const piiMatch = text.match(piiRegex);
			if (piiMatch) {
				issues.push({ type: "pii", span: piiMatch[0] });
			}
			for (const w of toxicWords) {
				const wordRegex = new RegExp(`\\b${w}\\b`, "i");
				if (wordRegex.test(text)) {
					issues.push({ type: "toxicity", span: w });
					break;
				}
			}
			return { passed: issues.length === 0, issues };
		};

		const enforce = (text: string) =>
			Effect.gen(function* () {
				const result = check(text);
				if (!result.passed) {
					return yield* Effect.fail(new GuardrailViolationError({ issues: result.issues }));
				}
				return undefined;
			});

		const rateLimit = (key: string) =>
			Effect.gen(function* () {
				const now = Date.now();
				const windowStart = now - 60_000;
				const map = yield* Ref.get(counters);
				const entry = map.get(key);
				const count = entry && entry.window > windowStart ? entry.count : 0;
				if (count + 1 > config.maxRequestsPerMinute) {
					return yield* Effect.fail(new RateLimitExceededError({ span: key }));
				}
				map.set(key, { count: count + 1, window: now });
				yield* Ref.set(counters, map);
			});

		return {
			check: (text: string) => Effect.succeed(check(text)),
			enforce,
			rateLimit,
		};
	});

export const GuardrailsLive = Layer.effect(Guardrails, makeGuardrails(defaultConfig));
