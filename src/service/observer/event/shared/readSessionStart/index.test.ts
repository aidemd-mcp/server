import { describe, it, expect } from "vitest";
import readSessionStart from "./index.js";

describe("readSessionStart", () => {
	it("reads the UTC time out of a real-shaped session id", () => {
		expect(readSessionStart({ sessionId: "20261125T091020123Z-abc123" })).toBe(Date.UTC(2026, 10, 25, 9, 10, 20, 123));
	});

	it("answers null for an id that does not carry a time", () => {
		expect(readSessionStart({ sessionId: "claude-session-1" })).toBeNull();
		expect(readSessionStart({ sessionId: "20261125T091020123-abc123" })).toBeNull();
	});

	it("answers null for a date that does not exist", () => {
		expect(readSessionStart({ sessionId: "20261345T091020123Z-abc123" })).toBeNull();
		expect(readSessionStart({ sessionId: "20260230T091020123Z-abc123" })).toBeNull();
		expect(readSessionStart({ sessionId: "20261125T256020123Z-abc123" })).toBeNull();
	});
});
