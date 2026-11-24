import { describe, it, expect } from "vitest";
import formatReply from "./index.js";

describe("formatReply", () => {
	it("formats started", () => {
		expect(formatReply({ outcome: "started", link: "http://127.0.0.1:24680/x?token=t" })).toBe(
			"Observer running at http://127.0.0.1:24680/x?token=t",
		);
	});

	it("formats started with a replaced version", () => {
		expect(formatReply({ outcome: "started", link: "L", replaced: "0.14.0" })).toBe(
			"Observer running at L (replaced the older observer, version 0.14.0)",
		);
	});

	it("formats running", () => {
		expect(formatReply({ outcome: "running", link: "L" })).toBe("Observer already running at L");
	});

	it("formats stuck with both versions and the link", () => {
		expect(formatReply({ outcome: "stuck", runningVersion: "0.14.0", ownVersion: "0.15.0", link: "L" })).toBe(
			"Observer not replaced: the running observer is version 0.14.0, older than this AIDE (0.15.0), and did not shut down; it is still serving at L",
		);
	});

	it("formats not-started", () => {
		expect(formatReply({ outcome: "not-started", reason: "port 24680 is busy" })).toBe(
			"Observer not started: port 24680 is busy",
		);
	});
});
