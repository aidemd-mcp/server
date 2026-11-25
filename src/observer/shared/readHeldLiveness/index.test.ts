import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LivenessReport, SessionLiveness } from "@/types/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/readLiveness/index.js", () => ({ default: vi.fn() }));

import readLiveness from "@/service/observer/event/readLiveness/index.js";
import readHeldLiveness from "./index.js";

const mockReadLiveness = readLiveness as ReturnType<typeof vi.fn>;
const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const WORKING: SessionLiveness = { state: "working", lastActivityAt: null, quietMinutes: 0, maybeStuck: false };

function makeHeld({ projectKey, sessionId }: { projectKey: string; sessionId: string }): HeldSession {
	return { projectKey, sessionId, events: [] };
}

function makeContext({ held }: { held: HeldSession[] }): ObserverContext {
	const sessions = vi.fn(({ projectKey }: { projectKey?: string } = {}) =>
		projectKey === undefined ? held : held.filter((session) => session.projectKey === projectKey),
	);
	return { store: { sessions }, now: () => NOW } as unknown as ObserverContext;
}

describe("readHeldLiveness", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadLiveness.mockImplementation(
			async ({ projectKey, sessions }: { projectKey: string; sessions: { sessionId: string }[] }): Promise<LivenessReport> => ({
				sessions: Object.fromEntries(sessions.map((s) => [s.sessionId, { ...WORKING, quietMinutes: projectKey.length }])),
				unlinked: [],
			}),
		);
	});

	it("calls readLiveness once per project with that project's sessions and ctx.now(), keyed by project", async () => {
		const a1 = makeHeld({ projectKey: "a-aaaaaa", sessionId: "a1" });
		const a2 = makeHeld({ projectKey: "a-aaaaaa", sessionId: "a2" });
		const b1 = makeHeld({ projectKey: "bb-bbbbbb", sessionId: "b1" });

		const result = await readHeldLiveness({ ctx: makeContext({ held: [a1, b1, a2] }) });

		expect(mockReadLiveness).toHaveBeenCalledTimes(2);
		expect(mockReadLiveness).toHaveBeenCalledWith({ projectKey: "a-aaaaaa", sessions: [a1, a2], now: NOW });
		expect(mockReadLiveness).toHaveBeenCalledWith({ projectKey: "bb-bbbbbb", sessions: [b1], now: NOW });
		expect([...result.keys()].sort()).toEqual(["a-aaaaaa", "bb-bbbbbb"]);
		expect(Object.keys(result.get("a-aaaaaa")!.sessions)).toEqual(["a1", "a2"]);
	});

	it("reads one project only when a project key is given", async () => {
		const a1 = makeHeld({ projectKey: "a-aaaaaa", sessionId: "a1" });
		const b1 = makeHeld({ projectKey: "bb-bbbbbb", sessionId: "b1" });
		const ctx = makeContext({ held: [a1, b1] });

		const result = await readHeldLiveness({ ctx, projectKey: "bb-bbbbbb" });

		expect(ctx.store.sessions).toHaveBeenCalledWith({ projectKey: "bb-bbbbbb" });
		expect(mockReadLiveness).toHaveBeenCalledTimes(1);
		expect([...result.keys()]).toEqual(["bb-bbbbbb"]);
	});

	it("answers an empty map and reads nothing when the store holds no session", async () => {
		const result = await readHeldLiveness({ ctx: makeContext({ held: [] }) });

		expect(result.size).toBe(0);
		expect(mockReadLiveness).not.toHaveBeenCalled();
	});
});
