import { describe, it, expect } from "vitest";
import { schema } from "@/service/observer/event/shared/presencePing/index.js";

describe("presencePing schema", () => {
	it("accepts a body naming a Claude session", () => {
		const result = schema.safeParse({ claudeSessionId: "c1f0a2b3-1111-4222-8333-444455556666" });
		expect(result.success).toBe(true);
	});

	it.each([
		["no id", {}],
		["an empty id", { claudeSessionId: "" }],
		["an unsafe id", { claudeSessionId: "../escape" }],
		["an id over 128 characters", { claudeSessionId: "a".repeat(129) }],
		["an extra key", { claudeSessionId: "abc", state: "working" }],
		["a non-string id", { claudeSessionId: 7 }],
	])("rejects %s", (_name, value) => {
		expect(schema.safeParse(value).success).toBe(false);
	});
});
