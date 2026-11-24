import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult, ConnectionState, StreamFrame, StreamSource } from "@/observer/page/types/index.js";
import connectStream from "./index.js";

class FakeSource implements StreamSource {
	onopen: ((event: Event) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	closed = false;
	private listeners = new Map<string, (event: { data: string }) => void>();

	constructor(readonly url: string) {}

	addEventListener(name: string, listener: (event: { data: string }) => void): void {
		this.listeners.set(name, listener);
	}

	close(): void {
		this.closed = true;
	}

	emit(name: string, data: unknown): void {
		this.listeners.get(name)?.({ data: JSON.stringify(data) });
	}
}

function setup({ probeResults, projectKey }: { probeResults?: ApiResult<unknown>[]; projectKey?: string } = {}) {
	const sources: FakeSource[] = [];
	const frames: StreamFrame[] = [];
	const states: ConnectionState[] = [];
	const results = [...(probeResults ?? [])];
	const probe = vi.fn(async () => results.shift() ?? ({ ok: true, data: {} } as ApiResult<unknown>));
	const connection = connectStream({
		token: "tok",
		projectKey,
		onFrame: (frame) => frames.push(frame),
		onConnection: (state) => states.push(state),
		openSource: (url) => {
			const source = new FakeSource(url);
			sources.push(source);
			return source;
		},
		probe,
	});
	return { sources, frames, states, probe, connection };
}

const fail = (status: number): ApiResult<unknown> => ({ ok: false, status, message: "x" });

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("connectStream", () => {
	it("opens the stream with the project filter and the token", () => {
		const { sources } = setup({ projectKey: "my app-1a2b3c" });
		expect(sources[0]?.url).toBe("/api/stream?project=my%20app-1a2b3c&token=tok");
	});

	it("opens an unfiltered stream for Home", () => {
		const { sources } = setup();
		expect(sources[0]?.url).toBe("/api/stream?token=tok");
	});

	it("hands parsed frames to onFrame and reports live on open", () => {
		const { sources, frames, states } = setup();
		sources[0]?.emit("projects", { projects: [] });
		sources[0]?.emit("aide-event", { projectKey: "p", event: { seq: 1 } });
		sources[0]?.onopen?.(new Event("open"));
		expect(frames).toEqual([
			{ name: "projects", data: { projects: [] } },
			{ name: "aide-event", data: { projectKey: "p", event: { seq: 1 } } },
		]);
		expect(states).toEqual(["live"]);
	});

	it("reconnects after an error once the probe answers 200, then reports live on the new open", async () => {
		const { sources, states, probe } = setup({ probeResults: [fail(503), { ok: true, data: {} }] });
		sources[0]?.onopen?.(new Event("open"));
		sources[0]?.onerror?.(new Event("error"));
		expect(sources[0]?.closed).toBe(true);
		expect(states).toEqual(["live", "reconnecting"]);

		await vi.advanceTimersByTimeAsync(2000);
		expect(probe).toHaveBeenCalledTimes(1);
		expect(sources).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(2000);
		expect(probe).toHaveBeenCalledTimes(2);
		expect(sources).toHaveLength(2);

		sources[1]?.onopen?.(new Event("open"));
		expect(states).toEqual(["live", "reconnecting", "live"]);
	});

	it("probes a first load that fails at once and reports not-found on 404 without a reconnecting step", async () => {
		const { sources, states, probe } = setup({ probeResults: [fail(404)] });
		sources[0]?.onerror?.(new Event("error"));
		await vi.advanceTimersByTimeAsync(0);
		expect(states).toEqual(["not-found"]);
		await vi.advanceTimersByTimeAsync(10000);
		expect(probe).toHaveBeenCalledTimes(1);
	});

	it("probes a first load that fails at once and reports unauthorized on 401, never showing reconnecting", async () => {
		const { sources, states, probe } = setup({ probeResults: [fail(401)] });
		sources[0]?.onerror?.(new Event("error"));
		expect(sources[0]?.closed).toBe(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(states).toEqual(["unauthorized"]);
		await vi.advanceTimersByTimeAsync(10000);
		expect(probe).toHaveBeenCalledTimes(1);
		expect(sources).toHaveLength(1);
	});

	it("reports reconnecting only once the first-load probe fails otherwise, then keeps probing every 2 s", async () => {
		const { sources, states, probe } = setup({ probeResults: [fail(0), { ok: true, data: {} }] });
		sources[0]?.onerror?.(new Event("error"));
		expect(states).toEqual([]);
		await vi.advanceTimersByTimeAsync(0);
		expect(states).toEqual(["reconnecting"]);
		expect(probe).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(2000);
		expect(probe).toHaveBeenCalledTimes(2);
		expect(sources).toHaveLength(2);
	});

	it("probes at once only for the first failure: a reopened stream that fails again waits the 2 s", async () => {
		const { sources, states, probe } = setup({ probeResults: [{ ok: true, data: {} }, { ok: true, data: {} }] });
		sources[0]?.onerror?.(new Event("error"));
		await vi.advanceTimersByTimeAsync(0);
		expect(sources).toHaveLength(2);

		sources[1]?.onerror?.(new Event("error"));
		expect(states).toEqual(["reconnecting"]);
		await vi.advanceTimersByTimeAsync(1999);
		expect(probe).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(probe).toHaveBeenCalledTimes(2);
	});

	it("reports unauthorized after a live stream drops and the 2 s probe answers 401", async () => {
		const { sources, states, probe } = setup({ probeResults: [fail(401)] });
		sources[0]?.onopen?.(new Event("open"));
		sources[0]?.onerror?.(new Event("error"));
		await vi.advanceTimersByTimeAsync(2000);
		expect(states).toEqual(["live", "reconnecting", "unauthorized"]);
		await vi.advanceTimersByTimeAsync(10000);
		expect(probe).toHaveBeenCalledTimes(1);
	});

	it("close() cancels a pending probe and closes the source", async () => {
		const { sources, probe, connection } = setup();
		sources[0]?.onopen?.(new Event("open"));
		sources[0]?.onerror?.(new Event("error"));
		connection.close();
		await vi.advanceTimersByTimeAsync(10000);
		expect(probe).not.toHaveBeenCalled();
		expect(sources).toHaveLength(1);

		const live = setup();
		live.connection.close();
		expect(live.sources[0]?.closed).toBe(true);
	});
});
