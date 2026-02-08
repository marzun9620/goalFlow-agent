import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";

type Goal = {
	id: string;
	title: string;
	status: string;
	targetDate: string | null;
	progress: number;
};

export default function GoalsRoute() {
	const [goals, setGoals] = useState<Goal[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/goals")
			.then((r) => r.json())
			.then(setGoals)
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
					<p className="muted">Outcome tracking</p>
					<h1 style={{ margin: 0 }}>Goals</h1>
				</div>
			</div>
			<div className="grid cols-3">
				{goals.map((goal) => (
					<a className="card" key={goal.id} href={`/goals/${goal.id}`}>
						<p className="muted">{goal.targetDate ?? "No target"}</p>
						<h3 style={{ margin: "0 0 0.35rem 0" }}>{goal.title}</h3>
						<div className="muted">Progress {(goal.progress * 100).toFixed(0)}%</div>
						<div
							style={{
								marginTop: "0.6rem",
								background: "#1f2937",
								borderRadius: 8,
								height: 6,
							}}
						>
							<div
								style={{
									width: `${goal.progress * 100}%`,
									height: "100%",
									borderRadius: 8,
									background:
										goal.status === "on_track" || goal.status === "in_progress"
											? "linear-gradient(90deg,#22c55e,#4ade80)"
											: "linear-gradient(90deg,#f59e0b,#f97316)",
								}}
							/>
						</div>
					</a>
				))}
			</div>
		</Layout>
	);
}
