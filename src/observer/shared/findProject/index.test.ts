import { describe, expect, it, vi } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";
import findProject from "./index.js";

const KEY = "alpha-aaaaaa";

function makeStarted({ sessionId, ts, root }: { sessionId: string; ts: string; root?: string }): ObserverEvent {
	return { v: 1, ts, sessionId, seq: 1, pid: 1, kind: "session_started", ...(root !== undefined && { projectRoot: root }) };
}

function makeContext(held: HeldSession[]): ObserverContext {
	return {
		store: { sessions: vi.fn(({ projectKey }: { projectKey?: string } = {}) => held.filter((session) => session.projectKey === projectKey)) },
	} as unknown as ObserverContext;
}

describe("findProject", () => {
	it.each(["../x", "plain", "", "a/b-abcdef"])("answers missing for the invalid key %j without reading the store", (projectKey) => {
		const ctx = makeContext([]);

		expect(findProject({ ctx, projectKey })).toEqual({ kind: "missing" });
		expect(ctx.store.sessions).not.toHaveBeenCalled();
	});

	it("answers missing for a valid key with no held session", () => {
		expect(findProject({ ctx: makeContext([]), projectKey: KEY })).toEqual({ kind: "missing" });
	});

	it("answers the project's sessions and the root its newest session reported", () => {
		const sessions: HeldSession[] = [
			{ projectKey: KEY, sessionId: "old", events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", root: "/old" })] },
			{ projectKey: KEY, sessionId: "new", events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z", root: "/new" })] },
		];

		expect(findProject({ ctx: makeContext(sessions), projectKey: KEY })).toEqual({
			kind: "found",
			projectKey: KEY,
			projectRoot: "/new",
			sessions,
		});
	});

	it("never fills a root the newest session left out from an older one", () => {
		const sessions: HeldSession[] = [
			{ projectKey: KEY, sessionId: "old", events: [makeStarted({ sessionId: "old", ts: "2026-01-01T00:00:00.000Z", root: "/old" })] },
			{ projectKey: KEY, sessionId: "new", events: [makeStarted({ sessionId: "new", ts: "2026-02-01T00:00:00.000Z" })] },
		];

		expect(findProject({ ctx: makeContext(sessions), projectKey: KEY })).toMatchObject({ kind: "found", projectRoot: null });
	});

	it.each([".", "..", "relative/dir", "./x", "../other"])("treats the non-absolute reported root %j as no root", (root) => {
		const sessions: HeldSession[] = [{ projectKey: KEY, sessionId: "a", events: [makeStarted({ sessionId: "a", ts: "2026-01-01T00:00:00.000Z", root })] }];

		expect(findProject({ ctx: makeContext(sessions), projectKey: KEY })).toMatchObject({ kind: "found", projectRoot: null });
	});

	it("answers a null root when no session has a session_started", () => {
		const prompt: ObserverEvent = { v: 1, ts: "2026-01-01T00:00:00.000Z", sessionId: "a", seq: 1, pid: 1, kind: "prompt", text: "hi" };
		const sessions: HeldSession[] = [{ projectKey: KEY, sessionId: "a", events: [prompt] }];

		expect(findProject({ ctx: makeContext(sessions), projectKey: KEY })).toMatchObject({ kind: "found", projectRoot: null });
	});
});
