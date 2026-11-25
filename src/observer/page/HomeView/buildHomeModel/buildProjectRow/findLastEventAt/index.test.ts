import { describe, expect, it } from "vitest";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import findLastEventAt from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

function row(startedAt: string, lastEventAt: string | null): SessionRowModel {
	return { sessionId: startedAt, startedAt, lastEventAt, eventCount: 1, liveness: makeLiveness({ state: "ended" }), task: null, label: null };
}

describe("findLastEventAt", () => {
	it("is the newest of the rows' last events and the listed time", () => {
		const rows = [row("2026-01-01T08:00:00.000Z", "2026-01-01T08:30:00.000Z"), row("2026-01-01T09:00:00.000Z", "2026-01-01T09:10:00.000Z")];
		expect(findLastEventAt({ rows, listed: "2026-01-01T08:45:00.000Z" })).toBe("2026-01-01T09:10:00.000Z");
		expect(findLastEventAt({ rows, listed: "2026-01-01T10:00:00.000Z" })).toBe("2026-01-01T10:00:00.000Z");
	});

	it("uses a row's start when it has no event, and is null with nothing at all", () => {
		expect(findLastEventAt({ rows: [row("2026-01-01T08:00:00.000Z", null)], listed: null })).toBe("2026-01-01T08:00:00.000Z");
		expect(findLastEventAt({ rows: [], listed: null })).toBeNull();
	});
});
