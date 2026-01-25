import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import type { ErrorResponse } from "./domain/schemas.js";

type RequestContext = {
	requestId: string;
};

declare module "hono" {
	interface ContextVariableMap {
		reqCtx: RequestContext;
		user: { id: string } | null;
	}
}

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
	const headerId = c.req.header("x-request-id");
	const requestId = headerId ?? randomUUID();
	c.set("reqCtx", { requestId });
	await next();
	c.header("x-request-id", requestId, { append: false });
};

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
	const start = performance.now();
	await next();
	const elapsed = (performance.now() - start).toFixed(1);
	const reqCtx = c.get("reqCtx");
	console.log(
		`[${reqCtx?.requestId ?? "n/a"}] ${c.req.method} ${c.req.path} -> ${c.res.status} (${elapsed}ms)`,
	);
};

export const authStubMiddleware: MiddlewareHandler = async (c, next) => {
	c.set("user", null);
	await next();
};

export const rateLimitStubMiddleware: MiddlewareHandler = async (c, next) => {
	c.header("x-rate-limit-remaining", "stub");
	await next();
};

export const errorHandlingMiddleware: MiddlewareHandler = async (c, next) => {
	try {
		await next();
	} catch (err) {
		const reqCtx = c.get("reqCtx");
		if (err instanceof HTTPException) {
			return err.getResponse();
		}
		const body: ErrorResponse = {
			error: err instanceof Error ? err.message : "Internal Server Error",
			requestId: reqCtx?.requestId,
		};
		return c.json(body, 500);
	}
};
