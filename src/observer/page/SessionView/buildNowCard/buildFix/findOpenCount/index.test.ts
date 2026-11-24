import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findOpenCount from "./index.js";

function verdict({ seq, ts, module, open }: { seq: number; ts: string; module: string; open?: number }): ObserverEvent {
	return { v: 1, ts, sessionId: "s1", pid: 1, seq, kind: "qa_verdict", module, verdict: "issues", ...(open === undefined ? {} : { open }) } as ObserverEvent;
}

describe("findOpenCount", () => {
	it("is the newest verdict's count for the module", () => {
		const events = [
			verdict({ seq: 1, ts: "2026-01-01T09:00:00.000Z", module: "src/a", open: 5 }),
			verdict({ seq: 3, ts: "2026-01-01T09:30:00.000Z", module: "src/a", open: 2 }),
			verdict({ seq: 4, ts: "2026-01-01T09:40:00.000Z", module: "src/b", open: 9 }),
		];
		expect(findOpenCount({ projectRoot: "/work/app", events, module: "src/a" })).toBe(2);
	});

	it("is null when the newest verdict reported no count, or none exists", () => {
		const events = [verdict({ seq: 1, ts: "2026-01-01T09:00:00.000Z", module: "src/a", open: 5 }), verdict({ seq: 2, ts: "2026-01-01T09:10:00.000Z", module: "src/a" })];
		expect(findOpenCount({ projectRoot: "/work/app", events, module: "src/a" })).toBeNull();
		expect(findOpenCount({ projectRoot: "/work/app", events: [], module: "src/a" })).toBeNull();
	});
});
