import { describe, it, expect } from "vitest";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import shouldRefresh, { PRESENCE_REFRESH_MS } from "./index.js";

const BASE_AT = "2026-11-25T10:00:00.000Z";
const OBSERVER = "20261125T100000000Z-abc123";

function makePresence(overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId: "claude-aaaa",
		state: "working",
		at: BASE_AT,
		hookEvent: "UserPromptSubmit",
		...overrides,
	};
}

function atPlus(ms: number): string {
	return new Date(Date.parse(BASE_AT) + ms).toISOString();
}

describe("shouldRefresh", () => {
	it("pins the refresh interval at 30 seconds", () => {
		expect(PRESENCE_REFRESH_MS).toBe(30_000);
	});

	const existing = makePresence({ sessionId: OBSERVER, transcriptPath: "/t/a.jsonl" });

	it.each<[string, Presence | null, Presence, boolean]>([
		["no stored record", null, makePresence(), true],
		["state changed", existing, { ...existing, state: "waiting", at: atPlus(1_000) }, true],
		[
			"link filled",
			makePresence({ transcriptPath: "/t/a.jsonl" }),
			makePresence({ transcriptPath: "/t/a.jsonl", sessionId: OBSERVER, at: atPlus(1_000) }),
			true,
		],
		[
			"an earlier link added",
			existing,
			{ ...existing, earlierSessionIds: ["20261124T100000000Z-aaa111"], at: atPlus(1_000) },
			true,
		],
		[
			"the same earlier links",
			{ ...existing, earlierSessionIds: ["20261124T100000000Z-aaa111"] },
			{ ...existing, earlierSessionIds: ["20261124T100000000Z-aaa111"], at: atPlus(1_000) },
			false,
		],
		["transcript path changed", existing, { ...existing, transcriptPath: "/t/b.jsonl", at: atPlus(1_000) }, true],
		[
			"transcript path filled while a newer record was kept",
			makePresence({ sessionId: OBSERVER }),
			makePresence({ sessionId: OBSERVER, transcriptPath: "/t/a.jsonl" }),
			true,
		],
		["same state 29 999 ms later", existing, { ...existing, at: atPlus(29_999) }, false],
		["same state 30 000 ms later", existing, { ...existing, at: atPlus(30_000) }, true],
		["only the hook event changed", existing, { ...existing, hookEvent: "PostToolUse", at: atPlus(5_000) }, false],
		["newer record kept with nothing filled", existing, { ...existing }, false],
	])("%s", (_name, stored, merged, expected) => {
		expect(shouldRefresh({ existing: stored, merged })).toBe(expected);
	});
});
