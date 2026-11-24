import { describe, expect, it } from "vitest";
import type { ProjectView, SessionListing } from "@/observer/types/index.js";
import type { ObserverEvent } from "@/types/index.js";
import type { StreamState } from "@/observer/page/types/index.js";
import reduceStream from "./index.js";

const initial: StreamState = { connection: "connecting", held: [], views: {}, listings: {}, projects: null };

function prompt({ sessionId, seq }: { sessionId: string; seq: number }): ObserverEvent {
	return {
		v: 1,
		ts: `2026-01-01T00:00:0${seq}.000Z`,
		sessionId,
		seq,
		pid: 1,
		kind: "prompt",
		text: `prompt ${seq}`,
	} as ObserverEvent;
}

function seqs({ state, sessionId }: { state: StreamState; sessionId: string }): number[] {
	return state.held.find((session) => session.sessionId === sessionId)!.events.map((event) => event.seq);
}

describe("reduceStream", () => {
	it("holds a snapshot and then the events that follow", () => {
		const snapped = reduceStream(initial, {
			name: "snapshot",
			data: { sessions: [{ projectKey: "p", sessionId: "s1", events: [prompt({ sessionId: "s1", seq: 1 })] }] },
		});
		const next = reduceStream(snapped, {
			name: "aide-event",
			data: { projectKey: "p", event: prompt({ sessionId: "s1", seq: 2 }) },
		});
		expect(seqs({ state: next, sessionId: "s1" })).toEqual([1, 2]);
	});

	it("keeps a duplicate (same session and seq) once", () => {
		const event = prompt({ sessionId: "s1", seq: 1 });
		const once = reduceStream(initial, { name: "aide-event", data: { projectKey: "p", event } });
		const twice = reduceStream(once, { name: "aide-event", data: { projectKey: "p", event } });
		expect(seqs({ state: twice, sessionId: "s1" })).toEqual([1]);
	});

	it("stores an out-of-order arrival in seq order", () => {
		let state = reduceStream(initial, {
			name: "aide-event",
			data: { projectKey: "p", event: prompt({ sessionId: "s1", seq: 1 }) },
		});
		state = reduceStream(state, { name: "aide-event", data: { projectKey: "p", event: prompt({ sessionId: "s1", seq: 3 }) } });
		state = reduceStream(state, { name: "aide-event", data: { projectKey: "p", event: prompt({ sessionId: "s1", seq: 2 }) } });
		expect(seqs({ state, sessionId: "s1" })).toEqual([1, 2, 3]);
	});

	it("sorts the events of a snapshot session by seq", () => {
		const state = reduceStream(initial, {
			name: "snapshot",
			data: {
				sessions: [
					{
						projectKey: "p",
						sessionId: "s1",
						events: [prompt({ sessionId: "s1", seq: 2 }), prompt({ sessionId: "s1", seq: 1 })],
					},
				],
			},
		});
		expect(seqs({ state, sessionId: "s1" })).toEqual([1, 2]);
	});

	it("creates the session of an event for an unknown session under the frame's project", () => {
		const state = reduceStream(initial, {
			name: "aide-event",
			data: { projectKey: "other", event: prompt({ sessionId: "new", seq: 1 }) },
		});
		expect(state.held).toHaveLength(1);
		expect(state.held[0]).toMatchObject({ projectKey: "other", sessionId: "new" });
	});

	it("replaces everything on a second snapshot and still keeps a re-sent event once", () => {
		const first = reduceStream(initial, {
			name: "snapshot",
			data: { sessions: [{ projectKey: "p", sessionId: "s1", events: [prompt({ sessionId: "s1", seq: 1 })] }] },
		});
		const second = reduceStream(first, {
			name: "snapshot",
			data: {
				sessions: [
					{
						projectKey: "p",
						sessionId: "s1",
						events: [prompt({ sessionId: "s1", seq: 1 }), prompt({ sessionId: "s1", seq: 2 })],
					},
				],
			},
		});
		const resent = reduceStream(second, {
			name: "aide-event",
			data: { projectKey: "p", event: prompt({ sessionId: "s1", seq: 2 }) },
		});
		expect(seqs({ state: resent, sessionId: "s1" })).toEqual([1, 2]);
	});

	it("replaces only the key a status, sessions or projects frame names", () => {
		const viewA = { state: "no-project-root", projectKey: "a", detail: "x" } as ProjectView;
		const viewB = { state: "no-project-root", projectKey: "b", detail: "y" } as ProjectView;
		let state = reduceStream(initial, { name: "status", data: { projectKey: "a", view: viewA } });
		state = reduceStream(state, { name: "status", data: { projectKey: "b", view: viewB } });
		const updatedA = { state: "no-project-root", projectKey: "a", detail: "z" } as ProjectView;
		state = reduceStream(state, { name: "status", data: { projectKey: "a", view: updatedA } });
		expect(state.views).toEqual({ a: updatedA, b: viewB });

		const listing = { sessionId: "s" } as SessionListing;
		state = reduceStream(state, { name: "sessions", data: { projectKey: "a", sessions: [listing] } });
		state = reduceStream(state, { name: "sessions", data: { projectKey: "b", sessions: [] } });
		expect(state.listings).toEqual({ a: [listing], b: [] });

		state = reduceStream(state, { name: "projects", data: { projects: [] } });
		expect(state.projects).toEqual([]);
		expect(state.views).toEqual({ a: updatedA, b: viewB });
	});

	it("sets the connection and never mutates its input", () => {
		const frozen = Object.freeze({ ...initial, held: Object.freeze([]) as never }) as StreamState;
		const next = reduceStream(frozen, { name: "connection", state: "live" });
		expect(next.connection).toBe("live");
		expect(frozen.connection).toBe("connecting");
	});
});
