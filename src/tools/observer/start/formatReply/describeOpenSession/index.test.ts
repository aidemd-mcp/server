import { describe, it, expect } from "vitest";
import describeOpenSession from "./index.js";
import type { OpenSession } from "../../types/index.js";

function makeOpen(overrides: Partial<OpenSession> = {}, liveness: Partial<OpenSession["liveness"]> = {}): OpenSession {
	return {
		id: "20261125T090000000Z-aaaaaa",
		idKind: "session",
		liveness: {
			state: "working",
			lastActivityAt: "2026-11-25T11:59:00.000Z",
			quietMinutes: 0,
			maybeStuck: false,
			...liveness,
		},
		pipeline: "feature-x",
		phase: "build",
		...overrides,
	};
}

describe("describeOpenSession", () => {
	it("describes an active working session with its pipeline and phase", () => {
		expect(describeOpenSession(makeOpen())).toBe(
			"- 20261125T090000000Z-aaaaaa · working · active · last activity 2026-11-25T11:59:00.000Z · pipeline feature-x · phase build",
		);
	});

	it("says waiting on the user and quiet minutes", () => {
		expect(describeOpenSession(makeOpen({}, { state: "waiting", quietMinutes: 7 }))).toContain(
			"· waiting on the user · quiet 7 min · last activity",
		);
	});

	it("adds maybe stuck when the liveness says so", () => {
		expect(describeOpenSession(makeOpen({}, { quietMinutes: 40, maybeStuck: true }))).toContain(
			"· quiet 40 min, maybe stuck ·",
		);
	});

	it("prefixes a Claude id and writes unknown and none for missing values", () => {
		const line = describeOpenSession(
			makeOpen({ id: "abc", idKind: "claude", pipeline: null, phase: null }, { lastActivityAt: null }),
		);

		expect(line).toBe("- claude:abc · working · active · last activity unknown · pipeline none · phase none");
	});
});
