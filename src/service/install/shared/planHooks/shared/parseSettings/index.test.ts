import { describe, it, expect } from "vitest";
import parseSettings from "./index.js";

describe("parseSettings", () => {
	it("returns the root and its hooks object", () => {
		const result = parseSettings("{ \"hooks\": { \"Stop\": [] }, \"permissions\": {} }");
		expect(result).toEqual({
			ok: true,
			settings: { hooks: { Stop: [] }, permissions: {} },
			hooks: { Stop: [] },
		});
	});

	it("returns an empty hooks object when the key is absent", () => {
		expect(parseSettings("{ \"permissions\": {} }")).toEqual({
			ok: true,
			settings: { permissions: {} },
			hooks: {},
		});
	});

	it("accepts comments and trailing commas", () => {
		const result = parseSettings("{\n  // note\n  \"hooks\": {},\n}\n");
		expect(result).toMatchObject({ ok: true, hooks: {} });
	});

	it("reports the first parse error with its offset", () => {
		const result = parseSettings("{ \"hooks\": ");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/^[A-Za-z]+ at offset \d+$/);
	});

	it("reports a root that is not an object", () => {
		expect(parseSettings("[1, 2]")).toEqual({ ok: false, reason: "the root is not a JSON object" });
		expect(parseSettings("\"text\"")).toEqual({ ok: false, reason: "the root is not a JSON object" });
	});

	it("reports a hooks value that is not an object", () => {
		expect(parseSettings("{ \"hooks\": [] }")).toEqual({ ok: false, reason: "\"hooks\" is not an object" });
		expect(parseSettings("{ \"hooks\": 3 }")).toEqual({ ok: false, reason: "\"hooks\" is not an object" });
	});
});
