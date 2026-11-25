import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LivenessReport, ObserverEvent, SessionLiveness } from "@/types/index.js";

vi.mock("@/service/observer/event/readLiveness/index.js", () => ({ default: vi.fn() }));

import readLiveness from "@/service/observer/event/readLiveness/index.js";
import createStreamHub from "../../createStreamHub/index.js";
import summarizeProjects from "../summarizeProjects/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";
import broadcastProjects from "./index.js";

const WORKING: SessionLiveness = { state: "working", lastActivityAt: null, quietMinutes: 0, maybeStuck: false };
const mockReadLiveness = readLiveness as ReturnType<typeof vi.fn>;
const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const DEAD_PID = 2_147_483_646;

type FakeResponse = EventEmitter & {
	writeHead: ReturnType<typeof vi.fn>;
	write: ReturnType<typeof vi.fn>;
	end: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
	writableLength: number;
	chunks: string[];
};

/** Factory for a response double that records every chunk written to it. */
function makeResponse(): FakeResponse {
	const res = new EventEmitter() as FakeResponse;
	res.chunks = [];
	res.writableLength = 0;
	res.writeHead = vi.fn();
	res.write = vi.fn((chunk: string) => {
		res.chunks.push(chunk);
		return true;
	});
	res.end = vi.fn();
	res.destroy = vi.fn();
	return res;
}

function asResponse(res: FakeResponse): ServerResponse {
	return res as unknown as ServerResponse;
}

function makeSession({ projectKey, sessionId, root }: { projectKey: string; sessionId: string; root: string }): HeldSession {
	const event = {
		v: 2,
		ts: "2026-01-01T11:50:00.000Z",
		sessionId,
		seq: 1,
		pid: DEAD_PID,
		kind: "session_started",
		projectRoot: root,
	} as ObserverEvent;
	return { projectKey, sessionId, events: [event] };
}

function makeContext({ sessions }: { sessions: HeldSession[] }): ObserverContext {
	return {
		store: { sessions: () => sessions },
		hub: createStreamHub(),
		now: () => NOW,
	} as unknown as ObserverContext;
}

/** Chunks after the retry line and the snapshot frame written at subscribe time. */
function framesAfterSubscribe(res: FakeResponse): string[] {
	return res.chunks.slice(2);
}

/** The liveness map the mocked recording side answers for these sessions: every one working. */
function workingFor(sessions: HeldSession[]): Map<string, LivenessReport> {
	const reports = new Map<string, LivenessReport>();
	for (const { projectKey, sessionId } of sessions) {
		const report = reports.get(projectKey) ?? { sessions: {}, unlinked: [] };
		report.sessions[sessionId] = WORKING;
		reports.set(projectKey, report);
	}
	return reports;
}

describe("broadcastProjects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadLiveness.mockImplementation(async ({ sessions }: { sessions: { sessionId: string }[] }) => ({
			sessions: Object.fromEntries(sessions.map((s) => [s.sessionId, WORKING])),
			unlinked: [],
		}));
	});

	it("broadcasts the home list built from the store as a projects frame", async () => {
		const sessions = [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })];
		const ctx = makeContext({ sessions });
		const res = makeResponse();
		ctx.hub.subscribe({ res: asResponse(res), snapshot: { sessions: [] } });

		await broadcastProjects({ ctx });

		const expected = summarizeProjects({ sessions, liveness: workingFor(sessions) });
		expect(expected).toHaveLength(1);
		expect(framesAfterSubscribe(res)).toEqual([`event: projects\ndata: ${JSON.stringify({ projects: expected })}\n\n`]);
	});

	it("reaches unfiltered clients and skips clients filtered to a project", async () => {
		const ctx = makeContext({ sessions: [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })] });
		const unfiltered = makeResponse();
		const filtered = makeResponse();
		ctx.hub.subscribe({ res: asResponse(unfiltered), snapshot: { sessions: [] } });
		ctx.hub.subscribe({ res: asResponse(filtered), snapshot: { sessions: [] }, projectKey: "a-aaaaaa" });

		await broadcastProjects({ ctx });

		expect(framesAfterSubscribe(unfiltered)).toHaveLength(1);
		expect(framesAfterSubscribe(filtered)).toEqual([]);
	});

	it("broadcasts an empty list when the store holds no sessions", async () => {
		const ctx = makeContext({ sessions: [] });
		const res = makeResponse();
		ctx.hub.subscribe({ res: asResponse(res), snapshot: { sessions: [] } });

		await broadcastProjects({ ctx });

		expect(framesAfterSubscribe(res)).toEqual([`event: projects\ndata: ${JSON.stringify({ projects: [] })}\n\n`]);
	});

	it("passes name, data and unfilteredOnly to the hub", async () => {
		const sessions = [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })];
		const broadcast = vi.fn();
		const ctx = { ...makeContext({ sessions }), hub: { broadcast } } as unknown as ObserverContext;

		await broadcastProjects({ ctx });

		expect(broadcast).toHaveBeenCalledWith({
			name: "projects",
			data: { projects: summarizeProjects({ sessions, liveness: workingFor(sessions) }) },
			unfilteredOnly: true,
		});
	});
});
