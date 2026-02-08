import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Layout } from "../components/Layout";

type Goal = {
	id: string;
	title: string;
	status: string;
	targetDate: string | null;
	progress: number;
};

type Task = {
	id: string;
	title: string;
	priority: string | null;
};

export default function GoalDetailRoute() {
	const { id } = useParams();
	const [goal, setGoal] = useState<Goal | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		Promise.all([
			fetch(`/api/goals/${id}`).then((r) => {
				if (r.status === 404) {
					setNotFound(true);
					return null;
				}
				return r.json();
			}),
			fetch("/api/tasks").then((r) => r.json()),
		])
			.then(([goalData, tasksData]) => {
				if (goalData) setGoal(goalData);
				setTasks(tasksData.slice(0, 3));
			})
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) {
		return (
			<Layout>
				<div className="header">
					<p className="muted">Loading...</p>
				</div>
			</Layout>
		);
	}

	const statusClass =
		goal?.status === "on_track" || goal?.status === "in_progress"
			? "success"
			: "warn";

	return (
		<Layout>
			{goal && !notFound ? (
				<>
					<p className="muted">Goal</p>
					<h1 style={{ marginTop: 0 }}>{goal.title}</h1>
					<div className="card grid cols-3">
						<div>
							<p className="muted">Status</p>
							<span className={`pill ${statusClass}`}>
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
							{tasks.map((task) => (
								<li key={task.id}>
									<a href={`/tasks/${task.id}`}>{task.title}</a>{" "}
									<span className="pill warn">{task.priority ?? "Medium"}</span>
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
