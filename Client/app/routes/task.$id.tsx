import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Layout } from "../components/Layout";

type Task = {
	id: string;
	title: string;
	status: string;
	priority: string | null;
	dueAt: string | null;
	assignee: string | null;
};

export default function TaskDetailRoute() {
	const { id } = useParams();
	const [task, setTask] = useState<Task | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [justification, setJustification] = useState<string | null>(null);
	const [justError, setJustError] = useState<string | null>(null);
	const [justLoading, setJustLoading] = useState(false);

	useEffect(() => {
		fetch(`/api/tasks/${id}`)
			.then((r) => {
				if (r.status === 404) {
					setNotFound(true);
					return null;
				}
				return r.json();
			})
			.then((data) => {
				if (data) setTask(data);
			})
			.finally(() => setLoading(false));
	}, [id]);

	const handleJustify = async () => {
		if (!task?.assignee) {
			setJustError("Assign the task first to request a justification.");
			return;
		}
		setJustError(null);
		setJustLoading(true);
		setJustification(null);
		try {
			const res = await fetch("/api/llm/justify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					personName: task.assignee,
					taskTitle: task.title,
					skillScore: 0.8,
					capacityScore: 0.6,
				}),
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || res.statusText);
			}
			const data = await res.json();
			setJustification(
				typeof data.text === "string" ? data.text : JSON.stringify(data),
			);
		} catch (err) {
			setJustError(err instanceof Error ? err.message : "Request failed");
		} finally {
			setJustLoading(false);
		}
	};

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
			{task && !notFound ? (
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
							<span className="pill warn">{task.priority ?? "Medium"}</span>
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
						<h2 style={{ margin: 0 }}>Match justification</h2>
						<span className="muted">
							{task.assignee ? `For ${task.assignee}` : "Assign to request"}
						</span>
					</div>
					<div className="card">
						<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
							<button
								type="button"
								disabled={justLoading || !task.assignee}
								onClick={handleJustify}
								className="btn"
							>
								{justLoading ? "Requesting..." : "Generate justification"}
							</button>
							{justError && <span className="pill danger">{justError}</span>}
						</div>
						<div style={{ marginTop: "12px" }}>
							{justification ? (
								<p style={{ margin: 0 }}>{justification}</p>
							) : (
								<p className="muted" style={{ margin: 0 }}>
									{justLoading
										? "Generating..."
										: "No justification yet. Click to generate."}
								</p>
							)}
						</div>
					</div>
				</>
			) : (
				<div className="card">Task not found.</div>
			)}
		</Layout>
	);
}
