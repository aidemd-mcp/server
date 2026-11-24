import { describe, expect, it } from "vitest";
import { HASH_LENGTH, HASH_SUFFIX } from "./index.js";

describe("projectKeyHash", () => {
	it("matches the hash tail of a project key", () => {
		expect(HASH_LENGTH).toBe(6);
		expect("my-app-0a1b2c".replace(HASH_SUFFIX, "")).toBe("my-app");
	});

	it.each(["my-app", "my-app-0a1b2", "my-app-0A1B2C", "my-app-0a1b2c7"])("leaves %s untouched", (value) => {
		expect(value.replace(HASH_SUFFIX, "")).toBe(value);
	});
});
