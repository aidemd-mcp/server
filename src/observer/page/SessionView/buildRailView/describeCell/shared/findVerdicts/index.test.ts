import { describe, expect, it } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import findVerdicts from "./index.js";

const verdict = (seq: number, result: "passed" | "issues") => makeEvent({ seq, ts: "2026-11-23T14:00:00.000Z", kind: "qa_verdict", module: "src/a", verdict: result });
const commit = makeEvent({ seq: 2, ts: "2026-11-23T14:00:00.000Z", kind: "commit", sha: "abcdef1" });

describe("findVerdicts", () => {
	it("is empty when the module has no verdict", () => {
		expect(findVerdicts({ moduleEvents: [] })).toEqual([]);
		expect(findVerdicts({ moduleEvents: [commit] })).toEqual([]);
	});

	it("keeps only the qa_verdict events, in the order given (oldest first)", () => {
		const events = [verdict(1, "issues"), commit, verdict(3, "passed")];
		expect(findVerdicts({ moduleEvents: events }).map((event) => event.seq)).toEqual([1, 3]);
	});
});
