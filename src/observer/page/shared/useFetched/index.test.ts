import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { ApiResult, Fetched } from "@/observer/page/types/index.js";
import useFetched from "./index.js";

type Load = (() => Promise<ApiResult<string>>) | null;

/** Mounts `useFetched` and exposes the latest value, re-rendering with new props on demand. */
function mount(initial: { key: string; load: Load }) {
	const latest: { fetched: Fetched<string> | null } = { fetched: null };
	function Probe(props: { key2: string; load: Load }) {
		latest.fetched = useFetched({ key: props.key2, load: props.load });
		return createElement(Text, null, latest.fetched.state);
	}
	const view = render(createElement(Probe, { key2: initial.key, load: initial.load }));
	return {
		view,
		rerender: (next: { key: string; load: Load }) => view.rerender(createElement(Probe, { key2: next.key, load: next.load })),
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get fetched(): Fetched<string> {
			if (latest.fetched === null) throw new Error("hook did not run");
			return latest.fetched;
		},
	};
}

describe("useFetched", () => {
	it("is loading until the call answers, then ready with its data", async () => {
		const probe = mount({ key: "a", load: () => Promise.resolve({ ok: true, data: "hello" }) });
		expect(probe.fetched).toEqual({ state: "loading" });

		await probe.settle();
		expect(probe.fetched).toEqual({ state: "ready", data: "hello" });
		probe.view.unmount();
	});

	it("reports the observer's own message when the call fails", async () => {
		const probe = mount({ key: "a", load: () => Promise.resolve({ ok: false, status: 404, message: "No such file" }) });

		await probe.settle();
		expect(probe.fetched).toEqual({ state: "error", message: "No such file" });
		probe.view.unmount();
	});

	it("runs the call again when the key changes and shows loading until it answers", async () => {
		const calls: string[] = [];
		const loader = (name: string): Load => () => {
			calls.push(name);
			return Promise.resolve({ ok: true, data: name });
		};
		const probe = mount({ key: "a", load: loader("a") });
		await probe.settle();

		probe.rerender({ key: "b", load: loader("b") });
		expect(probe.fetched).toEqual({ state: "loading" });
		await probe.settle();

		expect(calls).toEqual(["a", "b"]);
		expect(probe.fetched).toEqual({ state: "ready", data: "b" });
		probe.view.unmount();
	});

	it("drops an answer that arrives after the key changed", async () => {
		let resolveSlow: (result: ApiResult<string>) => void = () => {};
		const slow: Load = () => new Promise((resolve) => (resolveSlow = resolve));
		const probe = mount({ key: "a", load: slow });

		probe.rerender({ key: "b", load: () => Promise.resolve({ ok: true, data: "b-data" }) });
		await probe.settle();
		resolveSlow({ ok: true, data: "a-data" });
		await probe.settle();

		expect(probe.fetched).toEqual({ state: "ready", data: "b-data" });
		probe.view.unmount();
	});

	it("drops an answer that arrives after unmount", async () => {
		let resolveSlow: (result: ApiResult<string>) => void = () => {};
		const probe = mount({ key: "a", load: () => new Promise((resolve) => (resolveSlow = resolve)) });

		probe.view.unmount();
		resolveSlow({ ok: true, data: "late" });
		await probe.settle();

		expect(probe.fetched).toEqual({ state: "loading" });
	});

	it("runs nothing and stays loading for a null load", async () => {
		const probe = mount({ key: "a", load: null });

		await probe.settle();
		expect(probe.fetched).toEqual({ state: "loading" });
		probe.view.unmount();
	});
});
