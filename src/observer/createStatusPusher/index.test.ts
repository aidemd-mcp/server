import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectView, StreamHub } from "../types/index.js";
import createStatusPusher from "./index.js";

function makeHub(): StreamHub & { broadcast: ReturnType<typeof vi.fn> } {
	return { subscribe: vi.fn(), broadcast: vi.fn(), closeAll: vi.fn(), size: vi.fn(() => 0) };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const A = "alpha-aaaaaa";
const B = "beta-bbbbbb";
const asView = (marker: string): ProjectView => ({ marker }) as unknown as ProjectView;
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("createStatusPusher", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("coalesces three pushes during one slow rebuild into two rebuilds and two broadcasts", async () => {
		const hub = makeHub();
		const first = deferred<ProjectView>();
		const second = deferred<ProjectView>();
		const rebuild = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const { push } = createStatusPusher({ rebuild, hub });

		push(A);
		push(A);
		push(A);
		expect(rebuild).toHaveBeenCalledTimes(1);
		expect(rebuild).toHaveBeenCalledWith(A);

		first.resolve(asView("one"));
		await flush();
		expect(rebuild).toHaveBeenCalledTimes(2);

		second.resolve(asView("two"));
		await flush();

		expect(rebuild).toHaveBeenCalledTimes(2);
		expect(hub.broadcast).toHaveBeenCalledTimes(2);
		expect(hub.broadcast).toHaveBeenNthCalledWith(1, {
			name: "status",
			data: { projectKey: A, view: asView("one") },
			projectKey: A,
		});
		expect(hub.broadcast).toHaveBeenNthCalledWith(2, {
			name: "status",
			data: { projectKey: A, view: asView("two") },
			projectKey: A,
		});
	});

	it("keeps one queue per project: a slow rebuild of one project never holds another back", async () => {
		const hub = makeHub();
		const slow = deferred<ProjectView>();
		const rebuild = vi.fn((key: string) => (key === A ? slow.promise : Promise.resolve(asView(`view-${key}`))));
		const { push } = createStatusPusher({ rebuild, hub });

		push(A);
		push(B);
		await flush();

		expect(rebuild).toHaveBeenCalledTimes(2);
		expect(hub.broadcast).toHaveBeenCalledTimes(1);
		expect(hub.broadcast).toHaveBeenCalledWith({
			name: "status",
			data: { projectKey: B, view: asView(`view-${B}`) },
			projectKey: B,
		});

		slow.resolve(asView("late"));
		await flush();
		expect(hub.broadcast).toHaveBeenCalledTimes(2);
	});

	it("broadcasts nothing for a project the rebuild no longer finds", async () => {
		const hub = makeHub();
		const rebuild = vi.fn().mockResolvedValue(null);
		const { push } = createStatusPusher({ rebuild, hub });

		push(A);
		await flush();

		expect(rebuild).toHaveBeenCalledTimes(1);
		expect(hub.broadcast).not.toHaveBeenCalled();
	});

	it("broadcasts nothing on a failed rebuild, logs one line, and works on the next push", async () => {
		const hub = makeHub();
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const rebuild = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(asView("ok"));
		const { push } = createStatusPusher({ rebuild, hub });

		push(A);
		await flush();

		expect(hub.broadcast).not.toHaveBeenCalled();
		expect(stderr).toHaveBeenCalledTimes(1);
		expect(stderr).toHaveBeenCalledWith("observer: status rebuild failed: boom\n");

		push(A);
		await flush();

		expect(hub.broadcast).toHaveBeenCalledTimes(1);
		expect(hub.broadcast).toHaveBeenCalledWith({
			name: "status",
			data: { projectKey: A, view: asView("ok") },
			projectKey: A,
		});
	});

	it("still runs the pending rebuild after a failed one", async () => {
		const hub = makeHub();
		vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const first = deferred<ProjectView>();
		const rebuild = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(asView("after"));
		const { push } = createStatusPusher({ rebuild, hub });

		push(A);
		push(A);
		first.reject(new Error("fail"));
		await flush();

		expect(rebuild).toHaveBeenCalledTimes(2);
		expect(hub.broadcast).toHaveBeenCalledTimes(1);
		expect(hub.broadcast).toHaveBeenCalledWith({
			name: "status",
			data: { projectKey: A, view: asView("after") },
			projectKey: A,
		});
	});
});
