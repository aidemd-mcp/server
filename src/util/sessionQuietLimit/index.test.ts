import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import SESSION_QUIET_LIMIT_MS from "./index.js";

describe("SESSION_QUIET_LIMIT_MS", () => {
	it("is fifteen minutes in milliseconds", () => {
		expect(SESSION_QUIET_LIMIT_MS).toBe(900_000);
	});

	it("imports nothing from node:, so the page bundle can use it", () => {
		const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
		expect(source).not.toMatch(/node:/);
	});
});
