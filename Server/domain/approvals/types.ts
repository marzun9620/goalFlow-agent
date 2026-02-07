export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Approval = {
	id: string;
	requesterId: string;
	targetId: string;
	reason?: string | null;
	status: ApprovalStatus;
	createdAt: string;
	decidedAt?: string | null;
};
