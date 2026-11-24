import { describe, it, expect } from "vitest";
import buildObserverMessage from "./index.js";

describe("buildObserverMessage", () => {
	it("builds a started line, with or without a note", () => {
		expect(buildObserverMessage({ kind: "started", link: "L" })).toBe("Observer running at L");
		expect(buildObserverMessage({ kind: "started", link: "L", note: "Ctrl+C to stop" })).toBe(
			"Observer running at L (Ctrl+C to stop)",
		);
	});

	it("builds an already-running line", () => {
		expect(buildObserverMessage({ kind: "already-running", link: "L" })).toBe("Observer already running at L");
	});

	it("builds a stuck line naming both versions and the link", () => {
		expect(buildObserverMessage({ kind: "stuck", runningVersion: "0.14.0", ownVersion: "0.15.0", link: "L" })).toBe(
			"Observer not replaced: the running observer is version 0.14.0, older than this AIDE (0.15.0), and did not shut down; it is still serving at L",
		);
	});

	it("builds a not-started line", () => {
		expect(buildObserverMessage({ kind: "not-started", reason: "port 24680 is busy" })).toBe(
			"Observer not started: port 24680 is busy",
		);
	});
});
