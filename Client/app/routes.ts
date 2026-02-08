import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/_index.tsx"),
	route("/dashboard", "routes/dashboard.tsx"),
	route("/tasks", "routes/tasks.tsx"),
	route("/tasks/:id", "routes/task.$id.tsx"),
	route("/goals", "routes/goals.tsx"),
	route("/goals/:id", "routes/goal.$id.tsx"),
	route("/people", "routes/people.tsx"),
	route("/people/:id", "routes/person.$id.tsx"),
] satisfies RouteConfig;
