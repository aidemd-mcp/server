import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useCustomOrder from "./index.js";

const MODE = "aide-viewer:project-order-mode";
const LIST = "aide-viewer:project-order";

function stubStorage(initial: Record<string, string> = {}, broken = false) {
	const data = new Map(Object.entries(initial));
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => {
				if (broken) throw new Error("blocked");
				return data.get(key) ?? null;
			},
			setItem: (key: string, value: string) => {
				if (broken) throw new Error("blocked");
				data.set(key, value);
			},
		},
	});
	return data;
}

function mount() {
	const latest: { value: ReturnType<typeof useCustomOrder> | null } = { value: null };
	function Probe() {
		latest.value = useCustomOrder();
		return createElement(Text, null, "x");
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get hook(): ReturnType<typeof useCustomOrder> {
			if (latest.value === null) throw new Error("hook did not run");
			return latest.value;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useCustomOrder", () => {
	it("defaults to activity order with no saved list", () => {
		stubStorage();
		const probe = mount();
		expect(probe.hook.order).toBe("activity");
		expect(probe.hook.custom).toEqual([]);
		probe.view.unmount();
	});

	it("restores the stored mode and list, ignoring a mode it does not know and a list that is not strings", () => {
		stubStorage({ [MODE]: "custom", [LIST]: JSON.stringify(["a", 1, "b"]) });
		const known = mount();
		expect(known.hook.order).toBe("custom");
		expect(known.hook.custom).toEqual(["a", "b"]);
		known.view.unmount();

		stubStorage({ [MODE]: "sideways", [LIST]: "{oops" });
		const unknown = mount();
		expect(unknown.hook.order).toBe("activity");
		expect(unknown.hook.custom).toEqual([]);
		unknown.view.unmount();
	});

	it("changes and remembers the mode", async () => {
		const data = stubStorage();
		const probe = mount();
		probe.hook.setOrder("custom");
		await probe.settle();
		expect(probe.hook.order).toBe("custom");
		expect(data.get(MODE)).toBe("custom");
		probe.view.unmount();
	});

	it.each([
		["down the list lands after the target", ["a", "b", "c", "d"], "a", "c", ["b", "c", "a", "d"]],
		["up the list lands before the target", ["a", "b", "c", "d"], "d", "b", ["a", "d", "b", "c"]],
		["to the first place", ["a", "b", "c"], "c", "a", ["c", "a", "b"]],
		["to the last place", ["a", "b", "c"], "a", "c", ["b", "c", "a"]],
	])("moves a project %s", async (_, current, from, to, expected) => {
		const data = stubStorage();
		const probe = mount();
		probe.hook.move({ from, to, current });
		await probe.settle();
		expect(probe.hook.custom).toEqual(expected);
		expect(JSON.parse(data.get(LIST)!)).toEqual(expected);
		probe.view.unmount();
	});

	it("starts the saved list from the order on screen, and changes nothing when a project is dropped on itself", async () => {
		const data = stubStorage();
		const probe = mount();
		probe.hook.move({ from: "a", to: "a", current: ["a", "b"] });
		await probe.settle();
		expect(probe.hook.custom).toEqual([]);
		expect(data.has(LIST)).toBe(false);
		probe.view.unmount();
	});

	it("still works for this page when storage is blocked", async () => {
		stubStorage({}, true);
		const probe = mount();
		probe.hook.setOrder("custom");
		probe.hook.move({ from: "b", to: "a", current: ["a", "b"] });
		await probe.settle();
		expect(probe.hook.order).toBe("custom");
		expect(probe.hook.custom).toEqual(["b", "a"]);
		probe.view.unmount();
	});
});
