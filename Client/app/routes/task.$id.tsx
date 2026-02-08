import { useParams } from "react-router";
import { Layout } from "../components/Layout";
import { tasks } from "../domain/mockData";

export default function TaskDetailRoute() {
	const { id } = useParams();
	const task = tasks.find((t) => t.id === id);

	return (
		<Layout>
			{task ? (
				<>
					<p className="muted">Task detail</p>
					<h1 style={{ marginTop: 0 }}>{task.title}</h1>
					<div className="card grid">
						<div>
							<p className="muted">Status</p>
							<span className="pill">{task.status}</span>
						</div>
						<div>
							<p className="muted">Priority</p>
							<span className="pill warn">{task.priority}</span>
						</div>
						<div>
							<p className="muted">Assignee</p>
							<span className="pill">{task.assignee ?? "Unassigned"}</span>
						</div>
						<div>
							<p className="muted">Due date</p>
							<span className="pill">{task.dueAt ?? "Not set"}</span>
						</div>
					</div>
					<div className="section-title">
						<h2 style={{ margin: 0 }}>Notes</h2>
						<span className="muted">Match justification coming soon</span>
					</div>
					<div className="card muted">LLM justification will appear here.</div>
				</>
			) : (
				<div className="card">Task not found.</div>
			)}
		</Layout>
	);
}
