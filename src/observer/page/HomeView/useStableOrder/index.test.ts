import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStableOrder from "./index.js";

const KEY = "aide-viewer:project-activity-order";

function stubStorage(initial: string | null = null) {
	const data = new Map<string, string>(initial === null ? [] : [[KEY, initial]]);
	vi.stubGlobal("window", {
		localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) },
	});
	return data;
}

type Props = { wanted: string[]; ready: boolean };

function mount(initial: Props) {
	const latest: { value: ReturnType<typeof useStableOrder> | null } = { value: null };
	function Probe(props: Props) {
		latest.value = useStableOrder(props);
		return createElement(Text, null, "x");
	}
	const view = render(createElement(Probe, initial));
	return {
		view,
		update: (props: Props) => view.rerender(createElement(Probe, props)),
		get hook(): ReturnType<typeof useStableOrder> {
			if (latest.value === null) throw new Error("hook did not run");
			return latest.value;
		},
	};
}

/** Moves the fake clock by `ms`, then lets React (which schedules on the real event loop) flush the renders and effects that follow. */
async function tick(ms: number): Promise<void> {
	await vi.advanceTimersByTimeAsync(ms);
	await new Promise((resolve) => setImmediate(resolve));
	await new Promise((resolve) => setImmediate(resolve));
}
const flush = () => tick(0);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("useStableOrder", () => {
	it("starts from the order remembered in this browser, with new projects appended in the wanted order", async () => {
		stubStorage(JSON.stringify(["b", "a"]));
		const probe = mount({ wanted: ["a", "b", "c", "d"], ready: false });
		await flush();
		expect(probe.hook.order).toEqual(["b", "a", "c", "d"]);
		probe.view.unmount();
	});

	it("keeps a remembered order whole, even for projects not in the list yet, and starts from the wanted order with nothing stored", async () => {
		stubStorage(JSON.stringify(["gone", "a"]));
		const kept = mount({ wanted: ["a"], ready: false });
		await flush();
		expect(kept.hook.order).toEqual(["gone", "a"]);
		kept.view.unmount();

		stubStorage();
		const fresh = mount({ wanted: ["x", "y"], ready: false });
		await flush();
		expect(fresh.hook.order).toEqual(["x", "y"]);
		fresh.view.unmount();
	});

	it("ignores stored text that is not a list of strings", async () => {
		stubStorage("{oops");
		const probe = mount({ wanted: ["a"], ready: false });
		await flush();
		expect(probe.hook.order).toEqual(["a"]);
		probe.view.unmount();
	});

	it("does not adopt the activity order until every project's status has arrived", async () => {
		const data = stubStorage(JSON.stringify(["b", "a"]));
		const probe = mount({ wanted: ["a", "b"], ready: false });
		await flush();
		expect(probe.hook.order).toEqual(["b", "a"]);
		expect(data.get(KEY)).toBe(JSON.stringify(["b", "a"]));
		probe.view.unmount();
	});

	it("adopts the wanted order at once when ready, remembers it, and is not yet settled", async () => {
		const data = stubStorage(JSON.stringify(["b", "a"]));
		const probe = mount({ wanted: ["a", "b"], ready: false });
		probe.update({ wanted: ["a", "b"], ready: true });
		await flush();
		expect(probe.hook.order).toEqual(["a", "b"]);
		expect(data.get(KEY)).toBe(JSON.stringify(["a", "b"]));
		expect(probe.hook.settled).toBe(false);
		probe.view.unmount();
	});

	it("waits out the two-second gap before a later change, then moves and reports settled", async () => {
		stubStorage();
		const probe = mount({ wanted: ["a", "b"], ready: true });
		await flush();
		expect(probe.hook.settled).toBe(false);

		await tick(500);
		probe.update({ wanted: ["b", "a"], ready: true });
		await flush();
		expect(probe.hook.order).toEqual(["a", "b"]);

		await tick(1400);
		expect(probe.hook.order).toEqual(["a", "b"]);

		await tick(200);
		expect(probe.hook.order).toEqual(["b", "a"]);
		expect(probe.hook.settled).toBe(true);
		probe.view.unmount();
	});

	it("moves a change at once when the last move was over two seconds ago", async () => {
		stubStorage();
		const probe = mount({ wanted: ["a", "b"], ready: true });
		await flush();
		await tick(4500);
		probe.update({ wanted: ["b", "a"], ready: true });
		await flush();
		expect(probe.hook.order).toEqual(["b", "a"]);
		expect(probe.hook.settled).toBe(true);
		probe.view.unmount();
	});
});
