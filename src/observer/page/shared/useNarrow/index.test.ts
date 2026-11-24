import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useNarrow from "./index.js";

type ChangeListener = (event: { matches: boolean }) => void;

/** A `matchMedia` fake whose one query can flip and fire its change listeners. */
function stubMatchMedia(initial: boolean) {
	const queries: string[] = [];
	const listeners = new Set<ChangeListener>();
	const query = {
		matches: initial,
		addEventListener: (_name: "change", listener: ChangeListener) => void listeners.add(listener),
		removeEventListener: (_name: "change", listener: ChangeListener) => void listeners.delete(listener),
	};
	vi.stubGlobal("window", {
		matchMedia: (text: string) => {
			queries.push(text);
			return query;
		},
	});
	return {
		queries,
		listenerCount: () => listeners.size,
		flip: (matches: boolean) => {
			query.matches = matches;
			for (const listener of [...listeners]) listener({ matches });
		},
	};
}

/** Mounts `useNarrow` and hands back the latest value it returned. */
function mount() {
	const latest: { narrow: boolean | null } = { narrow: null };
	function Probe() {
		latest.narrow = useNarrow();
		return createElement(Text, null, String(latest.narrow));
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get narrow(): boolean {
			if (latest.narrow === null) throw new Error("hook did not run");
			return latest.narrow;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useNarrow", () => {
	it("asks for the 760px phone breakpoint and starts from its answer", () => {
		const media = stubMatchMedia(true);
		const probe = mount();
		expect(probe.narrow).toBe(true);
		expect(new Set(media.queries)).toEqual(new Set(["(max-width: 760px)"]));
		probe.view.unmount();
	});

	it("follows the query's change event", async () => {
		const media = stubMatchMedia(false);
		const probe = mount();
		expect(probe.narrow).toBe(false);

		media.flip(true);
		await probe.settle();
		expect(probe.narrow).toBe(true);

		media.flip(false);
		await probe.settle();
		expect(probe.narrow).toBe(false);
		probe.view.unmount();
	});

	it("removes its listener on unmount", async () => {
		const media = stubMatchMedia(false);
		const probe = mount();
		await probe.settle();
		expect(media.listenerCount()).toBe(1);

		probe.view.unmount();
		expect(media.listenerCount()).toBe(0);
	});
});
