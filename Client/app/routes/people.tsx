import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";

type Person = {
	id: string;
	name: string;
	role: string | null;
	capacity: number;
	load: number;
	skills: string[];
};

export default function PeopleRoute() {
	const [people, setPeople] = useState<Person[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/people")
			.then((r) => r.json())
			.then(setPeople)
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
					<p className="muted">Team</p>
					<h1 style={{ margin: 0 }}>People</h1>
				</div>
			</div>
			<div className="card">
				<table className="table" aria-label="people list">
					<thead>
						<tr>
							<th>Name</th>
							<th>Role</th>
							<th>Capacity</th>
							<th>Skills</th>
						</tr>
					</thead>
					<tbody>
						{people.map((person) => (
							<tr key={person.id}>
								<td>
									<a href={`/people/${person.id}`}>{person.name}</a>
								</td>
								<td>{person.role ?? "—"}</td>
								<td>
									<span className="pill success">
										{person.load}/{person.capacity} hrs
									</span>
								</td>
								<td>
									<div className="chip-row">
										{person.skills.slice(0, 3).map((skill) => (
											<span className="pill" key={skill}>
												{skill}
											</span>
										))}
										{person.skills.length > 3 && (
											<span className="muted">+{person.skills.length - 3}</span>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Layout>
	);
}
