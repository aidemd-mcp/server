import { describe, expect, it } from "vitest";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import buildHeader from "./index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");
const START = "2026-01-01T09:02:00.000Z";
const clockOf = (iso: string) => {
	const at = new Date(iso);
	return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};
const row = { sessionId: "s1", startedAt: START, lastEventAt: START, eventCount: 1, liveness: "live", task: null, label: null } as SessionRowModel;
const base = { route: { token: "tok", sessionId: "s1" }, name: "app", sessions: [row], firstEventAt: null, rootPath: "/work/app", kanbanTag: "app", switcher: [], now: NOW };

describe("buildHeader", () => {
	it("words the home link, project, session start, root and tag", () => {
		expect(buildHeader(base)).toEqual({
			homeHref: "/?token=tok",
			project: "app",
			sessionStart: clockOf(START),
			rootPath: "/work/app",
			kanbanTag: "app",
			switcher: [],
		});
	});

	it("falls back to the first held event for the start, and leaves unreported facts null", () => {
		const header = buildHeader({ ...base, sessions: [], firstEventAt: START, rootPath: undefined, kanbanTag: undefined });
		expect(header).toMatchObject({ sessionStart: clockOf(START), rootPath: null, kanbanTag: null });
	});

	it("has no start when the stream holds nothing for the session", () => {
		expect(buildHeader({ ...base, sessions: [] }).sessionStart).toBeNull();
	});
});
