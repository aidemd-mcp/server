import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createStreamHub from "./index.js";

type FakeResponse = EventEmitter & {
	writeHead: ReturnType<typeof vi.fn>;
	write: ReturnType<typeof vi.fn>;
	end: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
	writableLength: number;
	chunks: string[];
};

/** Factory for a response double that records every chunk written to it. */
function makeResponse(overrides: Partial<Pick<FakeResponse, "writableLength">> = {}): FakeResponse {
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
	Object.assign(res, overrides);
	return res;
}

function asResponse(res: FakeResponse): ServerResponse {
	return res as unknown as ServerResponse;
}

const emptySnapshot = { sessions: [] };

describe("createStreamHub", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("writes headers, retry and one snapshot frame, in that order", () => {
		const hub = createStreamHub();
		const res = makeResponse();
		hub.subscribe({ res: asResponse(res), snapshot: emptySnapshot });

		expect(res.writeHead).toHaveBeenCalledWith(
			200,
			expect.objectContaining({
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-store",
				Connection: "keep-alive",
				"X-Content-Type-Options": "nosniff",
			}),
		);
		expect(res.chunks).toEqual([
			"retry: 2000\n\n",
			`event: snapshot\ndata: ${JSON.stringify(emptySnapshot)}\n\n`,
		]);
		expect(res.writeHead.mock.invocationCallOrder[0]).toBeLessThan(res.write.mock.invocationCallOrder[0]);
		expect(hub.size()).toBe(1);
	});

	it("broadcasts identical frames to every client", () => {
		const hub = createStreamHub();
		const first = makeResponse();
		const second = makeResponse();
		hub.subscribe({ res: asResponse(first), snapshot: emptySnapshot });
		hub.subscribe({ res: asResponse(second), snapshot: emptySnapshot });

		hub.broadcast({ name: "status", data: { ok: true } });

		const expected = 'event: status\ndata: {"ok":true}\n\n';
		expect(first.chunks.at(-1)).toBe(expected);
		expect(second.chunks.at(-1)).toBe(expected);
	});

	it("destroys a client over the buffer limit and keeps reaching the others", () => {
		const hub = createStreamHub({ bufferLimit: 100 });
		const slow = makeResponse();
		const fast = makeResponse();
		hub.subscribe({ res: asResponse(slow), snapshot: emptySnapshot });
		hub.subscribe({ res: asResponse(fast), snapshot: emptySnapshot });

		slow.writableLength = 101;
		hub.broadcast({ name: "aide-event", data: 1 });
		hub.broadcast({ name: "aide-event", data: 2 });

		expect(slow.destroy).toHaveBeenCalledTimes(1);
		expect(slow.chunks.some((chunk) => chunk.includes("aide-event"))).toBe(false);
		expect(fast.chunks.filter((chunk) => chunk.startsWith("event: aide-event"))).toHaveLength(2);
		expect(hub.size()).toBe(1);
	});

	it("drops a client whose response closed", () => {
		const hub = createStreamHub();
		const gone = makeResponse();
		const stays = makeResponse();
		hub.subscribe({ res: asResponse(gone), snapshot: emptySnapshot });
		hub.subscribe({ res: asResponse(stays), snapshot: emptySnapshot });

		gone.emit("close");
		hub.broadcast({ name: "status", data: "x" });

		expect(hub.size()).toBe(1);
		expect(gone.chunks.some((chunk) => chunk.startsWith("event: status"))).toBe(false);
		expect(stays.chunks.at(-1)).toBe('event: status\ndata: "x"\n\n');
	});

	it("pings on the keepalive interval and stops after the last client closes", () => {
		const hub = createStreamHub({ keepaliveMs: 1000 });
		const res = makeResponse();
		hub.subscribe({ res: asResponse(res), snapshot: emptySnapshot });

		vi.advanceTimersByTime(2000);
		expect(res.chunks.filter((chunk) => chunk === ": ping\n\n")).toHaveLength(2);

		res.emit("close");
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(5000);
		expect(res.chunks.filter((chunk) => chunk === ": ping\n\n")).toHaveLength(2);
	});

	it("keeps the keepalive timer unref'd so it never holds the process open", () => {
		const unref = vi.spyOn(globalThis, "setInterval");
		const hub = createStreamHub({ keepaliveMs: 1000 });
		hub.subscribe({ res: asResponse(makeResponse()), snapshot: emptySnapshot });

		const timer = unref.mock.results[0]?.value as { hasRef: () => boolean };
		expect(timer.hasRef()).toBe(false);
		unref.mockRestore();
	});

	it("frames data holding newlines on a single line", () => {
		const hub = createStreamHub();
		const res = makeResponse();
		hub.subscribe({ res: asResponse(res), snapshot: emptySnapshot });

		hub.broadcast({ name: "aide-event", data: { text: "line one\nline two" } });

		const message = res.chunks.at(-1) as string;
		const lines = message.split("\n");
		expect(lines).toEqual(["event: aide-event", 'data: {"text":"line one\\nline two"}', "", ""]);
	});

	it("closeAll ends every response and clears the clients and the timer", () => {
		const hub = createStreamHub({ keepaliveMs: 1000 });
		const first = makeResponse();
		const second = makeResponse();
		hub.subscribe({ res: asResponse(first), snapshot: emptySnapshot });
		hub.subscribe({ res: asResponse(second), snapshot: emptySnapshot });

		hub.closeAll();

		expect(first.end).toHaveBeenCalledTimes(1);
		expect(second.end).toHaveBeenCalledTimes(1);
		expect(hub.size()).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	describe("project filter", () => {
		const A = "alpha-aaaaaa";
		const B = "beta-bbbbbb";

		function frames(res: FakeResponse): string[] {
			return res.chunks.filter((chunk) => chunk.startsWith("event: aide-event"));
		}

		it("sends a project's frame to a client filtered to it and to an unfiltered one, not to another project's client", () => {
			const hub = createStreamHub();
			const filteredA = makeResponse();
			const filteredB = makeResponse();
			const unfiltered = makeResponse();
			hub.subscribe({ res: asResponse(filteredA), snapshot: emptySnapshot, projectKey: A });
			hub.subscribe({ res: asResponse(filteredB), snapshot: emptySnapshot, projectKey: B });
			hub.subscribe({ res: asResponse(unfiltered), snapshot: emptySnapshot });

			hub.broadcast({ name: "aide-event", data: { n: 1 }, projectKey: A });

			expect(frames(filteredA)).toHaveLength(1);
			expect(frames(filteredB)).toHaveLength(0);
			expect(frames(unfiltered)).toHaveLength(1);
		});

		it("sends a frame with no project to every client, filtered or not", () => {
			const hub = createStreamHub();
			const filtered = makeResponse();
			const unfiltered = makeResponse();
			hub.subscribe({ res: asResponse(filtered), snapshot: emptySnapshot, projectKey: A });
			hub.subscribe({ res: asResponse(unfiltered), snapshot: emptySnapshot });

			hub.broadcast({ name: "aide-event", data: { n: 1 } });

			expect(frames(filtered)).toHaveLength(1);
			expect(frames(unfiltered)).toHaveLength(1);
		});

		it("sends an unfilteredOnly frame to clients with no project filter and to none that have one", () => {
			const hub = createStreamHub();
			const filtered = makeResponse();
			const unfiltered = makeResponse();
			hub.subscribe({ res: asResponse(filtered), snapshot: emptySnapshot, projectKey: A });
			hub.subscribe({ res: asResponse(unfiltered), snapshot: emptySnapshot });

			hub.broadcast({ name: "projects", data: { projects: [] }, unfilteredOnly: true });

			expect(filtered.chunks.filter((chunk) => chunk.startsWith("event: projects"))).toHaveLength(0);
			expect(unfiltered.chunks.filter((chunk) => chunk.startsWith("event: projects"))).toHaveLength(1);
		});

		it("still destroys a filtered client over the buffer limit and keeps the others", () => {
			const hub = createStreamHub({ bufferLimit: 10 });
			const stalled = makeResponse({ writableLength: 11 });
			const healthy = makeResponse();
			hub.subscribe({ res: asResponse(stalled), snapshot: emptySnapshot, projectKey: A });
			hub.subscribe({ res: asResponse(healthy), snapshot: emptySnapshot, projectKey: A });

			hub.broadcast({ name: "aide-event", data: { n: 1 }, projectKey: A });

			expect(stalled.destroy).toHaveBeenCalledTimes(1);
			expect(frames(healthy)).toHaveLength(1);
			expect(hub.size()).toBe(1);
		});
	});
});
