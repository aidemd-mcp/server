import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useTick from "./index.js";

/** Mounts `useTick` and hands back the latest count; only the interval clock is fake, so `settle` still waits on real time. */
function mount(live: boolean) {
	const latest: { ticks: number | null } = { ticks: null };
	function Probe(props: { live: boolean }) {
		latest.ticks = useTick(props.live);
		return createElement(Text, null, String(latest.ticks));
	}
	const view = render(createElement(Probe, { live }));
	return {
		view,
		setLive: (next: boolean) => view.rerender(createElement(Probe, { live: next })),
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get ticks(): number {
			if (latest.ticks === null) throw new Error("hook did not run");
			return latest.ticks;
		},
	};
}

describe("useTick", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts at 0 and grows by one every second while live", async () => {
		const probe = mount(true);
		await probe.settle();
		expect(probe.ticks).toBe(0);

		vi.advanceTimersByTime(3000);
		await probe.settle();
		expect(probe.ticks).toBe(3);
		probe.view.unmount();
	});

	it("never starts a timer while not live", async () => {
		const probe = mount(false);
		await probe.settle();
		expect(vi.getTimerCount()).toBe(0);

		vi.advanceTimersByTime(5000);
		await probe.settle();
		expect(probe.ticks).toBe(0);
		probe.view.unmount();
	});

	it("stops counting when live turns off, and counts again when it turns back on", async () => {
		const probe = mount(true);
		await probe.settle();
		vi.advanceTimersByTime(2000);
		await probe.settle();
		expect(probe.ticks).toBe(2);

		probe.setLive(false);
		await probe.settle();
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(5000);
		await probe.settle();
		expect(probe.ticks).toBe(2);

		probe.setLive(true);
		await probe.settle();
		vi.advanceTimersByTime(1000);
		await probe.settle();
		expect(probe.ticks).toBe(3);
		probe.view.unmount();
	});

	it("clears its timer on unmount", async () => {
		const probe = mount(true);
		await probe.settle();
		expect(vi.getTimerCount()).toBe(1);

		probe.view.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
