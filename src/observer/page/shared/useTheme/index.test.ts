import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useTheme from "./index.js";

type Hook = ReturnType<typeof useTheme>;

/** Stubs the `window` slice the hook reads: a localStorage fake (or a blocked one) and `matchMedia`. */
function stubWindow({ stored, prefersLight, blocked = false }: { stored?: string; prefersLight: boolean; blocked?: boolean }) {
	const writes: [string, string][] = [];
	const localStorage = blocked
		? {
				getItem: () => {
					throw new Error("blocked");
				},
				setItem: () => {
					throw new Error("blocked");
				},
			}
		: {
				getItem: (key: string) => (key === "aide-observer-theme" && stored !== undefined ? stored : null),
				setItem: (key: string, value: string) => void writes.push([key, value]),
			};
	vi.stubGlobal("window", {
		localStorage,
		matchMedia: (query: string) => ({ matches: query === "(prefers-color-scheme: light)" && prefersLight }),
	});
	return writes;
}

/** Mounts `useTheme` and hands back the latest value it returned. */
function mount() {
	const latest: { hook: Hook | null } = { hook: null };
	function Probe() {
		latest.hook = useTheme();
		return createElement(Text, null, latest.hook.theme);
	}
	const view = render(createElement(Probe));
	return {
		view,
		settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
		get hook(): Hook {
			if (latest.hook === null) throw new Error("hook did not run");
			return latest.hook;
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useTheme", () => {
	it("restores the stored choice over the colour-scheme preference", () => {
		stubWindow({ stored: "dark", prefersLight: true });
		const probe = mount();
		expect(probe.hook.theme).toBe("dark");
		probe.view.unmount();
	});

	it("follows prefers-color-scheme when nothing is stored", () => {
		stubWindow({ prefersLight: true });
		const light = mount();
		expect(light.hook.theme).toBe("light");
		light.view.unmount();

		stubWindow({ prefersLight: false });
		const dark = mount();
		expect(dark.hook.theme).toBe("dark");
		dark.view.unmount();
	});

	it("toggles and persists the choice under the existing key", async () => {
		const writes = stubWindow({ prefersLight: false });
		const probe = mount();

		probe.hook.toggle();
		await probe.settle();
		expect(probe.hook.theme).toBe("light");
		expect(writes).toEqual([["aide-observer-theme", "light"]]);

		probe.hook.toggle();
		await probe.settle();
		expect(probe.hook.theme).toBe("dark");
		expect(writes.at(-1)).toEqual(["aide-observer-theme", "dark"]);
		probe.view.unmount();
	});

	it("still works when the store is blocked", async () => {
		stubWindow({ prefersLight: true, blocked: true });
		const probe = mount();
		expect(probe.hook.theme).toBe("light");

		probe.hook.toggle();
		await probe.settle();
		expect(probe.hook.theme).toBe("dark");
		probe.view.unmount();
	});
});
