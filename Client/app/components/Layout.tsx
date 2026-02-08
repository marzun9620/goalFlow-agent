import type { PropsWithChildren } from "react";
import { NavLink } from "react-router";

const navItems = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/tasks", label: "Tasks" },
	{ to: "/goals", label: "Goals" },
	{ to: "/people/p1", label: "People" },
];

export function Layout({ children }: PropsWithChildren) {
	return (
		<div className="layout">
			<aside className="sidebar">
				<div className="logo">GoalFlow</div>
				<nav className="nav">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) => (isActive ? "active" : undefined)}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
			</aside>
			<div className="page">{children}</div>
		</div>
	);
}
