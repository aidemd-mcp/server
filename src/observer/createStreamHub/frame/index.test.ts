import { describe, it, expect } from "vitest";
import frame from "./index.js";

describe("frame", () => {
	it("writes the event name, one data line and a blank-line terminator", () => {
		expect(frame({ name: "status", data: { ok: true } })).toBe('event: status\ndata: {"ok":true}\n\n');
	});

	it("keeps data containing newlines on one line", () => {
		const message = frame({ name: "aide-event", data: { text: "a\nb" } });
		expect(message).toBe('event: aide-event\ndata: {"text":"a\\nb"}\n\n');
		expect(message.split("\n")).toHaveLength(4);
	});
});
