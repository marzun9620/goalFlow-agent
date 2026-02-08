import { Layout } from "../components/Layout";
import { goals, tasks } from "../domain/mockData";

const stats = [
	{ label: "Open Tasks", value: tasks.length, tone: "warn" as const },
	{
		label: "On-track Goals",
		value: goals.filter((g) => g.status === "on_track").length,
		tone: "success" as const,
	},
	{
		label: "At-risk Goals",
		value: goals.filter((g) => g.status === "at_risk").length,
		tone: "danger" as const,
	},
];

export default function DashboardRoute() {
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
										<span className="pill warn">{task.priority}</span>
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
