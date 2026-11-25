import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useElementHeight from "./index.js";

/** A `ResizeObserver` fake that records what it observes and lets a test fire its callback. */
function stubResizeObserver() {
	const instances: { observed: unknown[]; disconnected: boolean; callback: () => void }[] = [];
	class FakeResizeObserver {
		record: (typeof instances)[number];
		constructor(callback: () => void) {
			this.record = { observed: [], disconnected: false, callback };
			instances.push(this.record);
		}
		observe(target: unknown) {
			this.record.observed.push(target);
		}
		disconnect() {
			this.record.disconnected = true;
		}
	}
	vi.stubGlobal("ResizeObserver", FakeResizeObserver);
	return { instances };
}

/** An element-shaped object whose measured height a test can change. */
function makeElement(initial: number) {
	const box = { height: initial };
	const element = { getBoundingClientRect: () => ({ height: box.height }) } as unknown as HTMLElement;
	return { element, box };
}

/** Mounts `useElementHeight` and hands back the latest value it returned. */
function mount(element: HTMLElement | null) {
	const latest: { height: number | null } = { height: null };
	function Probe() {
		latest.height = useElementHeight(element);
		return createElement(Text, null, String(latest.height));
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get height(): number {
			if (latest.height === null) throw new Error("hook did not run");
			return latest.height;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useElementHeight", () => {
	it("returns 0 for a null element and builds no observer", async () => {
		const observers = stubResizeObserver();
		const probe = mount(null);
		await probe.settle();
		expect(probe.height).toBe(0);
		expect(observers.instances).toHaveLength(0);
		probe.view.unmount();
	});

	it("reports the element's rounded height after settling", async () => {
		stubResizeObserver();
		const { element } = makeElement(72.4);
		const probe = mount(element);
		await probe.settle();
		expect(probe.height).toBe(72);
		probe.view.unmount();
	});

	it("follows a ResizeObserver callback to a new height", async () => {
		const observers = stubResizeObserver();
		const { element, box } = makeElement(72);
		const probe = mount(element);
		await probe.settle();
		expect(observers.instances[0]?.observed).toEqual([element]);

		box.height = 118.6;
		observers.instances[0]?.callback();
		await probe.settle();
		expect(probe.height).toBe(119);
		probe.view.unmount();
	});

	it("disconnects on unmount", async () => {
		const observers = stubResizeObserver();
		const { element } = makeElement(72);
		const probe = mount(element);
		await probe.settle();
		expect(observers.instances[0]?.disconnected).toBe(false);

		probe.view.unmount();
		expect(observers.instances[0]?.disconnected).toBe(true);
	});

	it("still reports the first measurement when ResizeObserver is undefined", async () => {
		vi.stubGlobal("ResizeObserver", undefined);
		const { element } = makeElement(64);
		const probe = mount(element);
		await probe.settle();
		expect(probe.height).toBe(64);
		probe.view.unmount();
	});
});
