import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
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

const requestId: MiddlewareHandler = async (c, next) => {
	const headerId = c.req.header("x-request-id");
	const requestId = headerId ?? randomUUID();
	c.set("reqCtx", { requestId });
	await next();
	c.header("x-request-id", requestId, { append: false });
};

const logger: MiddlewareHandler = async (c, next) => {
	const start = performance.now();
	await next();
	const elapsed = (performance.now() - start).toFixed(1);
	const reqCtx = c.get("reqCtx");
	// eslint-disable-next-line no-console
	console.log(
		`[${reqCtx?.requestId ?? "n/a"}] ${c.req.method} ${c.req.path} -> ${c.res.status} (${elapsed}ms)`,
	);
};

const authStub: MiddlewareHandler = async (c, next) => {
	// Placeholder: in real flow, verify token and set user.
	c.set("user", null);
	await next();
};

const rateLimitStub: MiddlewareHandler = async (c, next) => {
	c.header("x-rate-limit-remaining", "stub");
	await next();
};

const errorHandler: MiddlewareHandler = async (c, next) => {
	try {
		await next();
	} catch (err) {
		const requestId = c.get("reqCtx")?.requestId;
		if (err instanceof HTTPException) {
			return err.getResponse();
		}
		const body: ErrorResponse = {
			error: err instanceof Error ? err.message : "Internal Server Error",
			requestId,
		};
		return c.json(body, 500);
	}
};

const onError: Parameters<MiddlewareHandler>[0]["onError"] = (err, c) => {
	const requestId = c.get("reqCtx")?.requestId;
	if (err instanceof HTTPException) {
		return c.json(
			{ error: err.message ?? "Internal Server Error", requestId },
			err.status,
		);
	}
	return c.json({ error: err.message ?? "Internal Server Error", requestId }, 500);
};

export function createRequestMiddlewares() {
	return {
		requestId,
		logger,
		authStub,
		rateLimitStub,
		errorHandler,
		onError,
	};
}
