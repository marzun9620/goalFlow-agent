import { Data, type Effect } from "effect";
import type { Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppServices } from "./layer.js";

export type ProblemDetails = {
	type?: string;
	title?: string;
	status: number;
	detail?: string;
	instance?: string;
	extensions?: Record<string, unknown>;
};

export class HttpError extends Data.TaggedError("HttpError")<ProblemDetails> {
	toJSON() {
		const base = {
			type: this.type ?? "about:blank",
			title: this.title ?? defaultTitle(this.status),
			status: this.status,
			...(this.detail ? { detail: this.detail } : {}),
			...(this.instance ? { instance: this.instance } : {}),
		} as Record<string, unknown>;

		if (this.extensions) {
			for (const [key, value] of Object.entries(this.extensions)) {
				if (["type", "title", "status", "detail", "instance"].includes(key)) continue;
				base[key] = value;
			}
		}

		return base;
	}
}

type ProblemInit =
	| string
	| (Omit<ProblemDetails, "status"> & {
			extensions?: Record<string, unknown>;
	  })
	| undefined;

const buildProblem = (status: number, init: ProblemInit) => {
	if (typeof init === "string") {
		return new HttpError({ status, detail: init });
	}
	return new HttpError({ status, ...init });
};

const defaultTitle = (status: number): string => {
	switch (status) {
		case 400:
			return "Bad Request";
		case 401:
			return "Unauthorized";
		case 403:
			return "Forbidden";
		case 404:
			return "Not Found";
		case 409:
			return "Conflict";
		case 429:
			return "Too Many Requests";
		case 422:
			return "Unprocessable Entity";
		default:
			return "Internal Server Error";
	}
};

export const badRequest = (init?: ProblemInit) => buildProblem(400, init);
export const unauthorized = (init?: ProblemInit) => buildProblem(401, init);
export const forbidden = (init?: ProblemInit) => buildProblem(403, init);
export const notFound = (init?: ProblemInit) => buildProblem(404, init);
export const conflict = (init?: ProblemInit) => buildProblem(409, init);
export const tooManyRequests = (init?: ProblemInit) => buildProblem(429, init);
export const internalServerError = (init?: ProblemInit) => buildProblem(500, init);

export const respond = (c: HonoContext, problem: HttpError) =>
	c.json(problem.toJSON(), problem.status as ContentfulStatusCode);

export type ServerEnv = {
	Variables: {
		run: <A, E>(eff: Effect.Effect<A, E, AppServices>) => Promise<A>;
		requestId: string;
	};
};
