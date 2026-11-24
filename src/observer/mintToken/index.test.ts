import { describe, expect, it } from "vitest";
import mintToken from "./index.js";

describe("mintToken", () => {
	it("returns 64 lowercase hex characters", () => {
		expect(mintToken()).toMatch(/^[0-9a-f]{64}$/);
	});

	it("returns a different token on every call", () => {
		expect(mintToken()).not.toBe(mintToken());
	});
});
