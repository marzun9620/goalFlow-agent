import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";

type Task = {
	id: string;
	title: string;
	priority: string | null;
	dueAt: string | null;
	assignee: string | null;
};

type Goal = {
	id: string;
	title: string;
	status: string;
	progress: number;
};

export default function DashboardRoute() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [goals, setGoals] = useState<Goal[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			fetch("/api/tasks").then((r) => r.json()),
			fetch("/api/goals").then((r) => r.json()),
		])
			.then(([tasksData, goalsData]) => {
				setTasks(tasksData);
				setGoals(goalsData);
			})
			.finally(() => setLoading(false));
	}, []);

	const stats = [
		{ label: "Open Tasks", value: tasks.length, tone: "warn" as const },
		{
			label: "On-track Goals",
			value: goals.filter((g) => g.status === "on_track" || g.status === "in_progress").length,
			tone: "success" as const,
		},
		{
			label: "At-risk Goals",
			value: goals.filter((g) => g.status === "at_risk").length,
			tone: "danger" as const,
		},
	];

	if (loading) {
		return (
			<Layout>
				<div className="header">
					<p className="muted">Loading...</p>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="header">
				<div>
					<p className="muted">Overview</p>
					<h1 style={{ margin: 0 }}>Dashboard</h1>
				</div>
			</div>

			<div className="grid cols-3">
				{stats.map((stat) => (
					<div className="card" key={stat.label}>
						<p className="muted">{stat.label}</p>
						<div className="stat-value">{stat.value}</div>
						<span className={`pill ${stat.tone}`}>{stat.tone}</span>
					</div>
				))}
			</div>

			<div className="section-title">
				<h2 style={{ margin: 0 }}>Upcoming tasks</h2>
				<span className="muted">Next due first</span>
			</div>
			<div className="card">
				<table className="table">
					<thead>
						<tr>
							<th>Title</th>
							<th>Assignee</th>
							<th>Priority</th>
							<th>Due</th>
						</tr>
					</thead>
					<tbody>
						{tasks
							.slice()
							.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
							.map((task) => (
								<tr key={task.id}>
									<td>{task.title}</td>
									<td>{task.assignee ?? "Unassigned"}</td>
									<td>
										<span className="pill warn">{task.priority ?? "Medium"}</span>
									</td>
									<td>{task.dueAt ?? "—"}</td>
								</tr>
							))}
					</tbody>
				</table>
			</div>
		</Layout>
	);
}
