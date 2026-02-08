import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import DashboardRoute from "./dashboard";

describe("Dashboard route", () => {
	it("renders stats", () => {
		render(
			<MemoryRouter>
				<DashboardRoute />
			</MemoryRouter>,
		);
		expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeDefined();
		expect(screen.getByText(/Open Tasks/i)).toBeDefined();
	});
});
