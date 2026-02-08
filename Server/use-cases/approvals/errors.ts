import { Data } from "effect";

export class ApprovalNotFoundError extends Data.TaggedError("ApprovalNotFoundError")<{
	id: string;
}> {}

export class ApprovalAlreadyDecidedError extends Data.TaggedError("ApprovalAlreadyDecidedError")<{
	id: string;
	status: string;
}> {}
