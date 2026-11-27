import { describe, it, expect } from "vitest";
import type { Presence } from "@/service/observer/event/shared/presenceRecord/index.js";
import groupConversations from "./index.js";

const A = "20261125T090000000Z-aaaaaa";
const B = "20261125T091000000Z-bbbbbb";
const C = "20261125T092000000Z-cccccc";

function makePresence(claudeSessionId: string, overrides: Partial<Presence> = {}): Presence {
	return {
		v: 1,
		claudeSessionId,
		state: "working",
		at: "2026-11-25T11:50:00.000Z",
		hookEvent: "PostToolUse",
		...overrides,
	};
}

describe("groupConversations", () => {
	it("returns no conversations for no presence", () => {
		expect(groupConversations({ presences: [] })).toEqual([]);
	});

	it("makes one conversation of a presence linked to the current and an earlier session", () => {
		const presence = makePresence("claude-1", { sessionId: B, earlierSessionIds: [A] });

		expect(groupConversations({ presences: [presence] })).toEqual([
			{ sessionIds: [A, B], claudeSessionIds: ["claude-1"], presences: [presence] },
		]);
	});

	it("joins presences that share an observer session, transitively, and keeps a separate one apart", () => {
		const one = makePresence("claude-1", { sessionId: B, earlierSessionIds: [A] });
		const two = makePresence("claude-2", { sessionId: B });
		const three = makePresence("claude-3", { sessionId: C });
		const bridge = makePresence("claude-4", { sessionId: C, earlierSessionIds: [A] });

		const apart = groupConversations({ presences: [one, two, three] });
		expect(apart.map((conversation) => conversation.sessionIds)).toEqual([[A, B], [C]]);
		expect(apart[0].claudeSessionIds).toEqual(["claude-1", "claude-2"]);

		const joined = groupConversations({ presences: [one, two, three, bridge] });
		expect(joined).toHaveLength(1);
		expect(joined[0].sessionIds).toEqual([A, B, C]);
		expect(joined[0].claudeSessionIds).toEqual(["claude-1", "claude-2", "claude-3", "claude-4"]);
		expect(joined[0].presences).toHaveLength(4);
	});

	it("keeps a presence with no link as a conversation of its own, after the linked ones", () => {
		const unlinkedLate = makePresence("claude-z");
		const unlinkedEarly = makePresence("claude-a");
		const linked = makePresence("claude-m", { sessionId: A });

		const conversations = groupConversations({ presences: [unlinkedLate, linked, unlinkedEarly] });

		expect(conversations.map((conversation) => conversation.claudeSessionIds)).toEqual([
			["claude-m"],
			["claude-a"],
			["claude-z"],
		]);
		expect(conversations[1]).toEqual({ sessionIds: [], claudeSessionIds: ["claude-a"], presences: [unlinkedEarly] });
	});

	it("orders linked conversations by their first observer id", () => {
		const later = makePresence("claude-1", { sessionId: C });
		const earlier = makePresence("claude-2", { sessionId: A });

		expect(groupConversations({ presences: [later, earlier] }).map((conversation) => conversation.sessionIds)).toEqual([
			[A],
			[C],
		]);
	});
});
