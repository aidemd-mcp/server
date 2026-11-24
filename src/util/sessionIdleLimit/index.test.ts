import { describe, it, expect } from "vitest";
import SESSION_IDLE_LIMIT_MS from "./index.js";

describe("SESSION_IDLE_LIMIT_MS", () => {
	it("is thirty minutes in milliseconds", () => {
		expect(SESSION_IDLE_LIMIT_MS).toBe(1_800_000);
	});
});
