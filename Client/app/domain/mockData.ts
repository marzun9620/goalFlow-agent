export type Task = {
	id: string;
	title: string;
	status: "pending" | "in_progress" | "blocked";
	priority: "High" | "Medium" | "Low";
	dueAt?: string;
	assignee?: string;
};

export type Goal = {
	id: string;
	title: string;
	status: "on_track" | "at_risk";
	targetDate?: string;
	progress: number; // 0-1
};

export type Person = {
	id: string;
	name: string;
	role: string;
	capacity: number;
	load: number;
	skills: string[];
};

export const tasks: Task[] = [
	{
		id: "t1",
		title: "Build scheduling endpoint",
		status: "in_progress",
		priority: "High",
		dueAt: "2026-02-20",
		assignee: "Alice Kim",
	},
	{
		id: "t2",
		title: "Match algorithm QA",
		status: "pending",
		priority: "Medium",
		dueAt: "2026-02-24",
		assignee: "Jamal Ortega",
	},
	{
		id: "t3",
		title: "Goal planning UX mocks",
		status: "blocked",
		priority: "High",
	},
];

export const goals: Goal[] = [
	{
		id: "g1",
		title: "Ship v1 scheduling",
		status: "on_track",
		targetDate: "2026-03-01",
		progress: 0.62,
	},
	{
		id: "g2",
		title: "Matching quality uplift",
		status: "at_risk",
		targetDate: "2026-03-15",
		progress: 0.38,
	},
];

export const people: Person[] = [
	{
		id: "p1",
		name: "Alice Kim",
		role: "Backend",
		capacity: 40,
		load: 22,
		skills: ["Node", "Effect", "Prisma"],
	},
	{
		id: "p2",
		name: "Jamal Ortega",
		role: "Frontend",
		capacity: 38,
		load: 30,
		skills: ["React", "Vite", "Design systems"],
	},
];
