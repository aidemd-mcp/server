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

	it("formats blocked as the BLOCKED line", () => {
		expect(formatReply({ outcome: "blocked", reason: "No port could be bound: 24680 (in use), 24681 (not allowed)" })).toBe(
			"BLOCKED: the observer could not start, so nothing proceeds. No port could be bound: 24680 (in use), 24681 (not allowed)",
		);
	});

	it.each([
		["started", { outcome: "started" as const, link: "L" }, "Observer running at L"],
		["running", { outcome: "running" as const, link: "L" }, "Observer already running at L"],
		[
			"stuck",
			{ outcome: "stuck" as const, runningVersion: "0.14.0", ownVersion: "0.15.0", link: "L" },
			"Observer not replaced: the running observer is version 0.14.0, older than this AIDE (0.15.0), and did not shut down; it is still serving at L",
		],
	])("formats reopened over a %s link reply: the REOPENED line, then the link reply", (_name, reply, second) => {
		expect(formatReply({ outcome: "reopened", reply }).split("\n")).toEqual([
			"REOPENED: this session was ended earlier and is open again; carry on.",
			second,
		]);
	});

	it("formats stopped for a newer session: the STOPPED line, then the link", () => {
		expect(formatReply({ outcome: "stopped", reason: "newer", link: "L" }).split("\n")).toEqual([
			"STOPPED: this session was ended and a newer session has worked this project since, so it cannot reopen. Nothing proceeds; the user continues in a new session.",
			"Observer: L",
		]);
	});

	it("formats stopped on the user's approval: the STOPPED line, then the link", () => {
		expect(formatReply({ outcome: "stopped", reason: "user", link: "L" }).split("\n")).toEqual([
			"STOPPED: this session was ended on the user's approval from another session, so it cannot reopen. Nothing proceeds; the user continues in a new session.",
			"Observer: L",
		]);
	});

	it("formats reopen-failed as a BLOCKED line with the detail, then the link", () => {
		expect(formatReply({ outcome: "reopen-failed", detail: "Could not write the log.", link: "L" }).split("\n")).toEqual([
			"BLOCKED: this session was ended earlier and could not be reopened, so nothing proceeds. Could not write the log.",
			"Observer: L",
		]);
	});

	it("formats the three-part HALT: the stop sentence, one line per open session, the link", () => {
		const liveness = {
			state: "working" as const,
			lastActivityAt: "2026-11-25T11:20:00.000Z",
			quietMinutes: 40,
			maybeStuck: true,
		};

		const text = formatReply({
			outcome: "halt",
			link: "http://127.0.0.1:24680/x?token=t",
			open: [
				{ id: "20261125T090000000Z-aaaaaa", idKind: "session", liveness, pipeline: "feature-x", phase: "build" },
				{
					id: "abc",
					idKind: "claude",
					liveness: { ...liveness, state: "waiting", quietMinutes: 0, maybeStuck: false },
					pipeline: null,
					phase: null,
				},
			],
		});

		expect(text.split("\n")).toEqual([
			"HALT: another session of this project is open. Nothing proceeds until the user approves ending it with aide_observer_end_session, or closes this session.",
			"- 20261125T090000000Z-aaaaaa · working · quiet 40 min, maybe stuck · last activity 2026-11-25T11:20:00.000Z · pipeline feature-x · phase build",
			"- claude:abc · waiting on the user · active · last activity 2026-11-25T11:20:00.000Z · pipeline none · phase none",
			"Observer: http://127.0.0.1:24680/x?token=t",
		]);
	});
});
