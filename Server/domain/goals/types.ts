export type MilestoneStatus = "pending" | "in_progress" | "completed";

export type Milestone = {
	title: string;
	tasks: string[];
	targetDate?: string | null;
	status: MilestoneStatus;
};

export type GoalView = {
	id: string;
	title: string;
	ownerId: string | null;
	targetDate: string | null;
	status: string | null;
	milestones: Milestone[];
	createdAt: string;
	updatedAt: string;
};

export type PersonWorkload = {
	personId: string;
	personName: string;
	allocatedHours: number;
};

export type DeadlineItem = {
	taskId: string;
	title: string;
	dueAt: string;
};

export type GoalProgress = {
	goalId: string;
	title: string;
	progress: number; // 0-1
};

export type WorkloadSummary = {
	workloads: PersonWorkload[];
	upcomingDeadlines: DeadlineItem[];
	goalProgress: GoalProgress[];
	computedAt: string;
};
