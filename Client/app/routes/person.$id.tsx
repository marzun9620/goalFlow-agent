import { useParams } from "react-router";
import { Layout } from "../components/Layout";
import { people, tasks } from "../domain/mockData";

export default function PersonRoute() {
	const { id } = useParams();
	const person = people.find((p) => p.id === id);
	const ownedTasks = tasks.filter((t) => t.assignee === person?.name);

	return (
		<Layout>
			{person ? (
				<>
					<p className="muted">Person</p>
					<h1 style={{ marginTop: 0 }}>{person.name}</h1>
					<div className="card grid cols-3">
						<div>
							<p className="muted">Role</p>
							<span className="pill">{person.role}</span>
						</div>
						<div>
							<p className="muted">Capacity</p>
							<span className="pill success">
								{person.load}/{person.capacity} hrs
							</span>
						</div>
						<div>
							<p className="muted">Skills</p>
							<div className="chip-row">
								{person.skills.map((skill) => (
									<span className="pill" key={skill}>
										{skill}
									</span>
								))}
							</div>
						</div>
					</div>
					<div className="section-title">
						<h2 style={{ margin: 0 }}>Assignments</h2>
						<span className="muted">{ownedTasks.length} tasks</span>
					</div>
					<div className="card">
						<ul className="list" aria-label="assignments">
							{ownedTasks.map((task) => (
								<li key={task.id}>
									<a href={`/tasks/${task.id}`}>{task.title}</a>{" "}
									<span className="pill">{task.status}</span>
								</li>
							))}
							{ownedTasks.length === 0 && (
								<span className="muted">No tasks yet.</span>
							)}
						</ul>
					</div>
				</>
			) : (
				<div className="card">Person not found.</div>
			)}
		</Layout>
	);
}
