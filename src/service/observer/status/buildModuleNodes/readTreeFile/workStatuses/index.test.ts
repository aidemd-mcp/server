import { describe, it, expect } from "vitest";
import WORK_STATUSES from "./index.js";

describe("WORK_STATUSES", () => {
	it("is exactly the governed work statuses in lifecycle order", () => {
		expect([...WORK_STATUSES]).toEqual(["proposed", "approved", "completed", "abandoned"]);
	});
});
