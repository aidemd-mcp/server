import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useMoreBelow from "./index.js";

type Listener = () => void;

/** A scrolling element fake: its geometry is mutable and it records its scroll listeners. */
function makeElement({ scrollTop = 0, clientHeight = 100, scrollHeight = 300 }: { scrollTop?: number; clientHeight?: number; scrollHeight?: number }) {
	const listeners = new Set<Listener>();
	const raw = {
		scrollTop,
		clientHeight,
		scrollHeight,
		addEventListener: (name: string, listener: Listener) => {
			if (name === "scroll") listeners.add(listener);
		},
		removeEventListener: (name: string, listener: Listener) => {
			if (name === "scroll") listeners.delete(listener);
		},
	};
	return { element: raw as unknown as HTMLElement, raw, scroll: () => [...listeners].forEach((listener) => listener()), count: () => listeners.size };
}

function mount(element: HTMLElement | null) {
	const latest: { more: boolean | null } = { more: null };
	function Probe() {
		latest.more = useMoreBelow(element);
		return createElement(Text, null, String(latest.more));
	}
	const view = render(createElement(Probe));
	return {
		view,
		get more() {
			return latest.more;
		},
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useMoreBelow", () => {
	it("is false with no element", () => {
		const probe = mount(null);
		expect(probe.more).toBe(false);
		probe.view.unmount();
	});

	it("is true while content lies below the visible part", async () => {
		const probe = mount(makeElement({ scrollTop: 0, clientHeight: 100, scrollHeight: 300 }).element);
		await settle();
		expect(probe.more).toBe(true);
		probe.view.unmount();
	});

	it("is false when everything fits, and within 8px of the end", async () => {
		const fits = mount(makeElement({ clientHeight: 100, scrollHeight: 100 }).element);
		await settle();
		expect(fits.more).toBe(false);
		fits.view.unmount();
		const nearEnd = mount(makeElement({ scrollTop: 195, clientHeight: 100, scrollHeight: 300 }).element);
		await settle();
		expect(nearEnd.more).toBe(false);
		nearEnd.view.unmount();
	});

	it("re-checks on scroll, so the cue goes once the end is reached", async () => {
		const fake = makeElement({ scrollTop: 0, clientHeight: 100, scrollHeight: 300 });
		const probe = mount(fake.element);
		await settle();
		expect(probe.more).toBe(true);

		fake.raw.scrollTop = 200;
		fake.scroll();
		await settle();
		expect(probe.more).toBe(false);
		probe.view.unmount();
	});

	it("listens on the element while mounted and stops when it unmounts", async () => {
		const fake = makeElement({});
		const probe = mount(fake.element);
		await settle();
		expect(fake.count()).toBe(1);
		probe.view.unmount();
		expect(fake.count()).toBe(0);
	});

	it("re-checks when the element resizes or its content changes, where the browser has the observers", async () => {
		const callbacks: Listener[] = [];
		const disconnect = vi.fn();
		class Observer {
			constructor(callback: Listener) {
				callbacks.push(callback);
			}
			observe(): void {}
			disconnect = disconnect;
		}
		vi.stubGlobal("ResizeObserver", Observer);
		vi.stubGlobal("MutationObserver", Observer);
		const fake = makeElement({ scrollTop: 0, clientHeight: 100, scrollHeight: 100 });
		const probe = mount(fake.element);
		await settle();
		expect(probe.more).toBe(false);
		expect(callbacks).toHaveLength(2);

		fake.raw.scrollHeight = 400;
		callbacks.forEach((callback) => callback());
		await settle();
		expect(probe.more).toBe(true);

		probe.view.unmount();
		expect(disconnect).toHaveBeenCalledTimes(2);
	});
});
