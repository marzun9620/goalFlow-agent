import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Index from "./_index";

describe("Index route", () => {
	it("renders the main heading", () => {
		render(<Index />);
		expect(screen.getByRole("heading", { name: /GoalFlow/i })).toBeDefined();
	});

	it("renders the description", () => {
		render(<Index />);
		expect(
			screen.getByText(
				/LLM-assisted workload, scheduling, and goal management/i,
			),
		).toBeDefined();
	});
});
