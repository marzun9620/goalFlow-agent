import * as S from "@effect/schema/Schema";

export const HealthResponseSchema = S.Struct({
	status: S.Literal("ok"),
});
export type HealthResponse = {
	status: "ok";
};

export const VersionResponseSchema = S.Struct({
	version: S.String,
});
export type VersionResponse = {
	version: string;
};

export const ErrorResponseSchema = S.Struct({
	error: S.String,
	requestId: S.optional(S.String),
});
export type ErrorResponse = {
	error: string;
	requestId?: string;
};
