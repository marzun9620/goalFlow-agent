export type TimeSlot = {
	start: string; // ISO8601
	end: string; // ISO8601
	personId: string;
	availabilityScore: number; // 0-1
};

export type Conflict = {
	personId: string;
	type: "event" | "assignment";
	start: string;
	end: string;
	title?: string | null;
	source?: string | null;
	reason?: string;
};

export type ScheduleProposal = {
	taskId: string;
	proposedSlots: TimeSlot[];
	recommendation?: TimeSlot;
	conflicts: Conflict[];
	computedAt: string;
};
