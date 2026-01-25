import * as S from "@effect/schema/Schema";

export const HealthResponseSchema = S.struct({
	status: S.literal("ok"),
});
export type HealthResponse = S.Schema.To<typeof HealthResponseSchema>;

export const VersionResponseSchema = S.struct({
	version: S.string,
});
export type VersionResponse = S.Schema.To<typeof VersionResponseSchema>;

export const ErrorResponseSchema = S.struct({
	error: S.string,
	requestId: S.optional(S.string),
});
export type ErrorResponse = S.Schema.To<typeof ErrorResponseSchema>;
