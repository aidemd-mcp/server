import { describe, expect, it } from "vitest";
import { schema } from "./index.js";

describe("shutdownRequest schema", () => {
	it("accepts a non-empty version string", () => {
		expect(schema.safeParse({ version: "0.16.0" }).success).toBe(true);
	});

	it.each([{}, { version: "" }, { version: 1 }, { version: "1.0.0", extra: 1 }, "1.0.0", null])("rejects %j", (value) => {
		expect(schema.safeParse(value).success).toBe(false);
	});
});
