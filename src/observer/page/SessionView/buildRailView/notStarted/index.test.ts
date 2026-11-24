import { describe, expect, it } from "vitest";
import NOT_STARTED from "./index.js";

describe("NOT_STARTED", () => {
	it("is the words a cell or lane reads when no event has reported on it", () => {
		expect(NOT_STARTED).toBe("Not started");
	});
});
