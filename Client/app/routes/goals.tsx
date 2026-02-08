import { Layout } from "../components/Layout";
import { goals } from "../domain/mockData";

export default function GoalsRoute() {
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
						<div className="muted">
							Progress {(goal.progress * 100).toFixed(0)}%
						</div>
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
										goal.status === "on_track"
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
