import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useInView from "./index.js";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

interface FakeObserver {
	options: { rootMargin: string; threshold: number };
	targets: Element[];
	disconnected: boolean;
	fire: (isIntersecting: boolean) => void;
}

/** Stubs a recording `IntersectionObserver`; every instance built is kept in `observers`. */
function stubIntersectionObserver() {
	const observers: FakeObserver[] = [];
	class FakeIntersectionObserver {
		private readonly fake: FakeObserver;
		constructor(callback: Callback, options: { rootMargin: string; threshold: number }) {
			this.fake = {
				options,
				targets: [],
				disconnected: false,
				fire: (isIntersecting) => callback([{ isIntersecting }]),
			};
			observers.push(this.fake);
		}
		observe(target: Element) {
			this.fake.targets.push(target);
		}
		disconnect() {
			this.fake.disconnected = true;
		}
	}
	vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
	return observers;
}

/** A stand-in for a DOM element; the hook only hands it to the observer. */
function makeElement(): Element {
	return {} as Element;
}

/** Mounts `useInView` and hands back the latest value it returned. */
function mount(initial: { element: Element | null; topInset: number }) {
	const latest: { inView: boolean | null } = { inView: null };
	function Probe(props: { element: Element | null; topInset: number }) {
		latest.inView = useInView(props);
		return createElement(Text, null, String(latest.inView));
	}
	const view = render(createElement(Probe, initial));
	return {
		view,
		rerender: (next: { element: Element | null; topInset: number }) => view.rerender(createElement(Probe, next)),
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get inView(): boolean {
			if (latest.inView === null) throw new Error("hook did not run");
			return latest.inView;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useInView", () => {
	it("is true and builds no observer for a null element", async () => {
		const observers = stubIntersectionObserver();
		const probe = mount({ element: null, topInset: 72 });
		await probe.settle();
		expect(probe.inView).toBe(true);
		expect(observers).toHaveLength(0);
		probe.view.unmount();
	});

	it("starts true before any entry arrives", async () => {
		stubIntersectionObserver();
		const probe = mount({ element: makeElement(), topInset: 72 });
		expect(probe.inView).toBe(true);
		await probe.settle();
		expect(probe.inView).toBe(true);
		probe.view.unmount();
	});

	it("observes the element with a rootMargin that clears the top inset", async () => {
		const observers = stubIntersectionObserver();
		const element = makeElement();
		const probe = mount({ element, topInset: 72 });
		await probe.settle();
		expect(observers).toHaveLength(1);
		expect(observers[0]?.options).toEqual({ rootMargin: "-72px 0px 0px 0px", threshold: 0 });
		expect(observers[0]?.targets).toEqual([element]);
		probe.view.unmount();
	});

	it("follows isIntersecting from the observer's entries", async () => {
		const observers = stubIntersectionObserver();
		const probe = mount({ element: makeElement(), topInset: 72 });
		await probe.settle();

		observers[0]?.fire(false);
		await probe.settle();
		expect(probe.inView).toBe(false);

		observers[0]?.fire(true);
		await probe.settle();
		expect(probe.inView).toBe(true);
		probe.view.unmount();
	});

	it("rebuilds the observer with the new margin when topInset changes", async () => {
		const observers = stubIntersectionObserver();
		const element = makeElement();
		const probe = mount({ element, topInset: 72 });
		await probe.settle();

		probe.rerender({ element, topInset: 96 });
		await probe.settle();
		expect(observers).toHaveLength(2);
		expect(observers[0]?.disconnected).toBe(true);
		expect(observers[1]?.disconnected).toBe(false);
		expect(observers[1]?.options.rootMargin).toBe("-96px 0px 0px 0px");
		probe.view.unmount();
	});

	it("disconnects on unmount", async () => {
		const observers = stubIntersectionObserver();
		const probe = mount({ element: makeElement(), topInset: 72 });
		await probe.settle();
		expect(observers[0]?.disconnected).toBe(false);

		probe.view.unmount();
		expect(observers[0]?.disconnected).toBe(true);
	});

	it("is true without throwing when IntersectionObserver is undefined", async () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		const probe = mount({ element: makeElement(), topInset: 72 });
		await probe.settle();
		expect(probe.inView).toBe(true);
		probe.view.unmount();
	});
});
