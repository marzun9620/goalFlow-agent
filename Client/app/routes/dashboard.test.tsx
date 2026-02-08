import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardRoute from "./dashboard";

describe("Dashboard route", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders stats", async () => {
		const mockResponses: Record<string, unknown> = {
			"/api/tasks": [
				{
					id: "t1",
					title: "Demo task",
					status: "pending",
					priority: "medium",
					dueAt: null,
					assignee: "Sam",
				},
			],
			"/api/goals": [
				{
					id: "g1",
					title: "Demo goal",
					status: "on_track",
					progress: 0.5,
					targetDate: null,
				},
			],
		};

		vi.spyOn(global, "fetch").mockImplementation((input) =>
			Promise.resolve({
				json: () => Promise.resolve(mockResponses[String(input)] ?? []),
			} as Response),
		);

		render(
			<MemoryRouter>
				<DashboardRoute />
			</MemoryRouter>,
		);
		expect(
			await screen.findByRole("heading", { name: /Dashboard/i }),
		).toBeDefined();
		expect(await screen.findByText(/Open Tasks/i)).toBeDefined();
	});
});
