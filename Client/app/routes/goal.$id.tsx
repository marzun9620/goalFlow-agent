import { useParams } from "react-router";
import { Layout } from "../components/Layout";
import { goals, tasks } from "../domain/mockData";

export default function GoalDetailRoute() {
	const { id } = useParams();
	const goal = goals.find((g) => g.id === id);
	const related = tasks.slice(0, 2);

	return (
		<Layout>
			{goal ? (
				<>
					<p className="muted">Goal</p>
					<h1 style={{ marginTop: 0 }}>{goal.title}</h1>
					<div className="card grid cols-3">
						<div>
							<p className="muted">Status</p>
							<span
								className={`pill ${goal.status === "on_track" ? "success" : "warn"}`}
							>
								{goal.status.replace("_", " ")}
							</span>
						</div>
						<div>
							<p className="muted">Target date</p>
							<span className="pill">{goal.targetDate ?? "Not set"}</span>
						</div>
						<div>
							<p className="muted">Progress</p>
							<span className="pill">{(goal.progress * 100).toFixed(0)}%</span>
						</div>
					</div>

					<div className="section-title">
						<h2 style={{ margin: 0 }}>Linked tasks</h2>
						<span className="muted">Preview</span>
					</div>
					<div className="card">
						<ul className="list" aria-label="linked tasks">
							{related.map((task) => (
								<li key={task.id}>
									<a href={`/tasks/${task.id}`}>{task.title}</a>{" "}
									<span className="pill warn">{task.priority}</span>
								</li>
							))}
						</ul>
					</div>
				</>
			) : (
				<div className="card">Goal not found.</div>
			)}
		</Layout>
	);
}
