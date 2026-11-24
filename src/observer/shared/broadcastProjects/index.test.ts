import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import createStreamHub from "../../createStreamHub/index.js";
import summarizeProjects from "../summarizeProjects/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";
import broadcastProjects from "./index.js";

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
		v: 1,
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

describe("broadcastProjects", () => {
	it("broadcasts the home list built from the store as a projects frame", () => {
		const sessions = [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })];
		const ctx = makeContext({ sessions });
		const res = makeResponse();
		ctx.hub.subscribe({ res: asResponse(res), snapshot: { sessions: [] } });

		broadcastProjects({ ctx });

		const expected = summarizeProjects({ sessions, now: NOW });
		expect(expected).toHaveLength(1);
		expect(framesAfterSubscribe(res)).toEqual([`event: projects\ndata: ${JSON.stringify({ projects: expected })}\n\n`]);
	});

	it("reaches unfiltered clients and skips clients filtered to a project", () => {
		const ctx = makeContext({ sessions: [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })] });
		const unfiltered = makeResponse();
		const filtered = makeResponse();
		ctx.hub.subscribe({ res: asResponse(unfiltered), snapshot: { sessions: [] } });
		ctx.hub.subscribe({ res: asResponse(filtered), snapshot: { sessions: [] }, projectKey: "a-aaaaaa" });

		broadcastProjects({ ctx });

		expect(framesAfterSubscribe(unfiltered)).toHaveLength(1);
		expect(framesAfterSubscribe(filtered)).toEqual([]);
	});

	it("broadcasts an empty list when the store holds no sessions", () => {
		const ctx = makeContext({ sessions: [] });
		const res = makeResponse();
		ctx.hub.subscribe({ res: asResponse(res), snapshot: { sessions: [] } });

		broadcastProjects({ ctx });

		expect(framesAfterSubscribe(res)).toEqual([`event: projects\ndata: ${JSON.stringify({ projects: [] })}\n\n`]);
	});

	it("passes name, data and unfilteredOnly to the hub", () => {
		const sessions = [makeSession({ projectKey: "a-aaaaaa", sessionId: "s1", root: "/a" })];
		const broadcast = vi.fn();
		const ctx = { ...makeContext({ sessions }), hub: { broadcast } } as unknown as ObserverContext;

		broadcastProjects({ ctx });

		expect(broadcast).toHaveBeenCalledWith({
			name: "projects",
			data: { projects: summarizeProjects({ sessions, now: NOW }) },
			unfilteredOnly: true,
		});
	});
});
