import { describe, expect, it } from "vitest";
import handoffTasks from "./index.js";

describe("handoffTasks", () => {
	it("gives every task its own slug and title", () => {
		const tasks = Object.values(handoffTasks);
		expect(new Set(tasks.map((entry) => entry.slug)).size).toBe(tasks.length);
		expect(new Set(tasks.map((entry) => entry.title)).size).toBe(tasks.length);
	});
});
