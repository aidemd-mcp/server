import { describe, it, expect } from "vitest";
import mergePresence from "./index.js";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import type { TouchPresenceInput } from "@/service/observer/event/types/index.js";

const CLAUDE = "claude-aaaa";
const OBSERVER = "20261125T100000000Z-abc123";

function makeInput(overrides: Partial<TouchPresenceInput> = {}): TouchPresenceInput {
	return {
		projectRoot: "/repo",
		claudeSessionId: CLAUDE,
		hookEvent: "UserPromptSubmit",
		state: "working",
		at: "2026-11-25T10:00:10.000Z",
		endsObserverSession: false,
		...overrides,
	};
}

function makePresence(overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId: CLAUDE,
		state: "waiting",
		at: "2026-11-25T10:00:00.000Z",
		hookEvent: "Stop",
		...overrides,
	};
}

describe("mergePresence", () => {
	it("builds a fresh record when none exists, omitting absent keys", () => {
		const merged = mergePresence({ existing: null, next: makeInput() });

		expect(merged).toEqual({
			v: 1,
			claudeSessionId: CLAUDE,
			state: "working",
			at: "2026-11-25T10:00:10.000Z",
			hookEvent: "UserPromptSubmit",
		});
		expect(Object.keys(merged)).not.toContain("sessionId");
		expect(Object.keys(merged)).not.toContain("transcriptPath");
	});

	it("lets a newer call replace state, time and hook", () => {
		const merged = mergePresence({ existing: makePresence(), next: makeInput() });

		expect(merged).toMatchObject({ state: "working", at: "2026-11-25T10:00:10.000Z", hookEvent: "UserPromptSubmit" });
	});

	it("keeps the existing state when the existing record is newer, but fills a missing link and transcript", () => {
		const existing = makePresence({ at: "2026-11-25T10:00:30.000Z" });
		const merged = mergePresence({
			existing,
			next: makeInput({ linkSessionId: OBSERVER, transcriptPath: "/t/a.jsonl" }),
		});

		expect(merged).toEqual({ ...existing, sessionId: OBSERVER, transcriptPath: "/t/a.jsonl" });
	});

	it("never replaces an existing link or transcript when the existing record is newer", () => {
		const existing = makePresence({
			at: "2026-11-25T10:00:30.000Z",
			sessionId: OBSERVER,
			transcriptPath: "/t/old.jsonl",
		});
		const merged = mergePresence({
			existing,
			next: makeInput({ linkSessionId: "20261125T110000000Z-fff999", transcriptPath: "/t/new.jsonl" }),
		});

		expect(merged).toEqual(existing);
	});

	it("keeps the old link and transcript path when a newer call lacks them", () => {
		const merged = mergePresence({
			existing: makePresence({ sessionId: OBSERVER, transcriptPath: "/t/a.jsonl" }),
			next: makeInput(),
		});

		expect(merged.sessionId).toBe(OBSERVER);
		expect(merged.transcriptPath).toBe("/t/a.jsonl");
	});

	it("takes a new link and transcript path from a newer call", () => {
		const merged = mergePresence({
			existing: makePresence({ sessionId: OBSERVER, transcriptPath: "/t/a.jsonl" }),
			next: makeInput({ linkSessionId: "20261125T110000000Z-fff999", transcriptPath: "/t/b.jsonl" }),
		});

		expect(merged.sessionId).toBe("20261125T110000000Z-fff999");
		expect(merged.transcriptPath).toBe("/t/b.jsonl");
	});

	it("treats an equal time as the new call winning", () => {
		const merged = mergePresence({
			existing: makePresence({ at: "2026-11-25T10:00:10.000Z" }),
			next: makeInput(),
		});

		expect(merged.state).toBe("working");
	});
});
