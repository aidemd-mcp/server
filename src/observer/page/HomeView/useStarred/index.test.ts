import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useStarred from "./index.js";

const KEY = "aide-viewer:starred-projects";

/** A `window.localStorage` fake backed by a map; `broken` makes every access throw. */
function stubStorage(initial: Record<string, string> = {}, broken = false) {
	const data = new Map(Object.entries(initial));
	const storage = {
		getItem: (key: string) => {
			if (broken) throw new Error("blocked");
			return data.get(key) ?? null;
		},
		setItem: (key: string, value: string) => {
			if (broken) throw new Error("blocked");
			data.set(key, value);
		},
	};
	vi.stubGlobal("window", { localStorage: storage });
	return data;
}

function mount() {
	const latest: { value: ReturnType<typeof useStarred> | null } = { value: null };
	function Probe() {
		latest.value = useStarred();
		return createElement(Text, null, "x");
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get hook(): ReturnType<typeof useStarred> {
			if (latest.value === null) throw new Error("hook did not run");
			return latest.value;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useStarred", () => {
	it("starts from the keys stored in this browser", () => {
		stubStorage({ [KEY]: JSON.stringify(["a-111111", "b-222222"]) });
		const probe = mount();
		expect([...probe.hook.starred]).toEqual(["a-111111", "b-222222"]);
		probe.view.unmount();
	});

	it.each([
		["nothing stored", {}],
		["text that is not JSON", { [KEY]: "{oops" }],
		["JSON that is not a list", { [KEY]: '{"a":1}' }],
	])("starts empty for %s", (_, initial) => {
		stubStorage(initial);
		const probe = mount();
		expect(probe.hook.starred.size).toBe(0);
		probe.view.unmount();
	});

	it("keeps only the string entries of a stored list", () => {
		stubStorage({ [KEY]: JSON.stringify(["a-111111", 4, null]) });
		const probe = mount();
		expect([...probe.hook.starred]).toEqual(["a-111111"]);
		probe.view.unmount();
	});

	it("stars and unstars a project, remembering the list", async () => {
		const data = stubStorage();
		const probe = mount();

		probe.hook.setStarred("a-111111", true);
		await probe.settle();
		expect(probe.hook.starred.has("a-111111")).toBe(true);
		expect(JSON.parse(data.get(KEY)!)).toEqual(["a-111111"]);

		probe.hook.setStarred("a-111111", false);
		await probe.settle();
		expect(probe.hook.starred.size).toBe(0);
		expect(JSON.parse(data.get(KEY)!)).toEqual([]);
		probe.view.unmount();
	});

	it("still works for this page when storage is blocked", async () => {
		stubStorage({}, true);
		const probe = mount();
		expect(probe.hook.starred.size).toBe(0);
		probe.hook.setStarred("a-111111", true);
		await probe.settle();
		expect(probe.hook.starred.has("a-111111")).toBe(true);
		probe.view.unmount();
	});
});
