import { Data } from "effect";

export class ConnectorError extends Data.TaggedError("ConnectorError")<{
	provider: string;
	operation: string;
	cause?: unknown;
}> {}
