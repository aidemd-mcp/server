import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import findFollowingFiles from "./index.js";

const T = "2026-11-23T14:00:00.000Z";
const finished = makeEvent({ seq: 2, ts: T, kind: "phase_finished", phase: "plan", agent: "a", module: "m" });
const file = (seq: number, sessionId = "s1") => makeEvent({ seq, ts: T, sessionId, kind: "file_written", path: `f${seq}`, action: "created" });

describe("findFollowingFiles", () => {
	it("takes the run of file writes right after the event, in seq order", () => {
		expect(findFollowingFiles({ event: finished, events: [file(4), finished, file(3), file(1)] }).map((event) => event.seq)).toEqual([3, 4]);
	});

	it("stops at the first event that is not a file write", () => {
		const other = makeEvent({ seq: 4, ts: T, kind: "prompt", text: "x" });
		expect(findFollowingFiles({ event: finished, events: [finished, file(3), other, file(5)] }).map((event) => event.seq)).toEqual([3]);
	});

	it("ignores another session's events", () => {
		expect(findFollowingFiles({ event: finished, events: [finished, file(3, "s2")] })).toEqual([]);
	});

	it("is empty when nothing follows", () => {
		expect(findFollowingFiles({ event: finished, events: [finished] })).toEqual([]);
	});
});
