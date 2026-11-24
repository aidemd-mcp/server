import { describe, it, expect } from "vitest";
import buildSessionPath from "@/service/observer/event/shared/buildSessionPath/index.js";

describe("buildSessionPath", () => {
	it("builds the session path from the key and id", () => {
		expect(buildSessionPath({ projectKey: "proj-a1b2c3", sessionId: "s1" })).toBe("/p/proj-a1b2c3/s/s1");
	});

	it("encodes reserved characters in the key and id", () => {
		expect(buildSessionPath({ projectKey: "my proj/x", sessionId: "a:b?c" })).toBe("/p/my%20proj%2Fx/s/a%3Ab%3Fc");
	});

	it("does not interpret replacement patterns in the key", () => {
		expect(buildSessionPath({ projectKey: "$&", sessionId: "$1" })).toBe("/p/%24%26/s/%241");
	});
});
