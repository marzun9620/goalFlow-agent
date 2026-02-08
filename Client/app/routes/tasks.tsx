import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";

type Task = {
	id: string;
	title: string;
	status: string;
	priority: string | null;
	dueAt: string | null;
	assignee: string | null;
};

export default function TasksRoute() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/tasks")
			.then((r) => r.json())
			.then(setTasks)
			.finally(() => setLoading(false));
	}, []);

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
					<p className="muted">Workboard</p>
					<h1 style={{ margin: 0 }}>Tasks</h1>
				</div>
			</div>
			<div className="card">
				<table className="table" aria-label="task list">
					<thead>
						<tr>
							<th>Title</th>
							<th>Assignee</th>
							<th>Status</th>
							<th>Priority</th>
							<th>Due</th>
						</tr>
					</thead>
					<tbody>
						{tasks.map((task) => (
							<tr key={task.id}>
								<td>
									<a href={`/tasks/${task.id}`}>{task.title}</a>
								</td>
								<td>{task.assignee ?? "Unassigned"}</td>
								<td>
									<span className="pill">{task.status}</span>
								</td>
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
