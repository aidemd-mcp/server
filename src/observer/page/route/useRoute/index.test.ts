import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { PageRoute } from "@/observer/page/types/index.js";
import useRoute from "./index.js";

type Hook = ReturnType<typeof useRoute>;

/** A location, history and popstate source that behave like the browser's: pushState moves the location. */
function makeBrowser(initial: string) {
	const url = new URL(initial, "http://127.0.0.1");
	const location = { pathname: url.pathname, search: url.search };
	const pushed: string[] = [];
	const listeners = new Set<() => void>();
	const move = (href: string) => {
		const next = new URL(href, "http://127.0.0.1");
		location.pathname = next.pathname;
		location.search = next.search;
	};
	return {
		location,
		pushed,
		history: {
			pushState: (_data: unknown, _unused: string, href: string) => {
				pushed.push(href);
				move(href);
			},
		},
		events: {
			addEventListener: (_name: "popstate", listener: () => void) => void listeners.add(listener),
			removeEventListener: (_name: "popstate", listener: () => void) => void listeners.delete(listener),
		},
		listenerCount: () => listeners.size,
		/** What Back does: the browser moves the location, then fires popstate. */
		back: (href: string) => {
			move(href);
			for (const listener of [...listeners]) listener();
		},
	};
}

/** Mounts `useRoute` and hands back the latest value it returned. */
function mount(browser: ReturnType<typeof makeBrowser>) {
	const latest: { hook: Hook | null } = { hook: null };
	function Probe() {
		latest.hook = useRoute({ location: browser.location, history: browser.history, events: browser.events });
		return createElement(Text, null, latest.hook.route.kind);
	}
	const view = render(createElement(Probe));
	const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
	return {
		view,
		settle,
		get hook(): Hook {
			if (latest.hook === null) throw new Error("hook did not run");
			return latest.hook;
		},
	};
}

const SESSION = "/p/k/s/s1?token=t";

describe("useRoute", () => {
	it("starts from the location", () => {
		const probe = mount(makeBrowser(SESSION));
		expect(probe.hook.route).toEqual({ kind: "session", token: "t", projectKey: "k", sessionId: "s1", tab: "tree", item: null });
		probe.view.unmount();
	});

	it("pushes a history entry and updates the route on setTab, openItem and closeItem", async () => {
		const browser = makeBrowser(SESSION);
		const probe = mount(browser);

		probe.hook.setTab("board");
		await probe.settle();
		expect(browser.pushed).toEqual(["/p/k/s/s1?token=t&tab=board"]);
		expect(probe.hook.route).toMatchObject({ tab: "board", item: null });

		probe.hook.openItem({ kind: "task", slug: "fix-it" });
		await probe.settle();
		expect(browser.pushed.at(-1)).toBe("/p/k/s/s1?token=t&tab=board&item=task%3Afix-it");
		expect(probe.hook.route).toMatchObject({ tab: "board", item: { kind: "task", slug: "fix-it" } });

		probe.hook.closeItem();
		await probe.settle();
		expect(browser.pushed.at(-1)).toBe("/p/k/s/s1?token=t&tab=board");
		expect(probe.hook.route).toMatchObject({ item: null });
		expect(browser.pushed).toHaveLength(3);
		probe.view.unmount();
	});

	it("builds two changes made in one handler on each other", async () => {
		const browser = makeBrowser(SESSION);
		const probe = mount(browser);
		const { setTab, openItem } = probe.hook;

		setTab("plans");
		openItem({ kind: "module", folder: "src/a" });
		await probe.settle();
		expect(browser.pushed.at(-1)).toBe("/p/k/s/s1?token=t&tab=plans&item=module%3Asrc%2Fa");
		expect(probe.hook.route).toMatchObject({ tab: "plans", item: { kind: "module", folder: "src/a" } });
		probe.view.unmount();
	});

	it("re-parses the location on popstate", async () => {
		const browser = makeBrowser(SESSION);
		const probe = mount(browser);
		probe.hook.setTab("record");
		await probe.settle();

		browser.back(SESSION);
		await probe.settle();
		expect(probe.hook.route).toMatchObject({ kind: "session", tab: "tree", item: null });

		browser.back("/?token=t");
		await probe.settle();
		expect(probe.hook.route).toEqual({ kind: "home", token: "t" });
		probe.view.unmount();
	});

	it.each<[string, PageRoute]>([
		["/?token=t", { kind: "home", token: "t" }],
		["/nowhere", { kind: "invalid" }],
	])("leaves %s alone when asked to change tab or item", async (start, expected) => {
		const browser = makeBrowser(start);
		const probe = mount(browser);

		probe.hook.setTab("board");
		probe.hook.openItem({ kind: "task", slug: "x" });
		probe.hook.closeItem();
		await probe.settle();
		expect(browser.pushed).toEqual([]);
		expect(probe.hook.route).toEqual(expected);
		probe.view.unmount();
	});

	it("stops listening when unmounted", () => {
		const browser = makeBrowser(SESSION);
		const probe = mount(browser);
		expect(browser.listenerCount()).toBe(1);
		probe.view.unmount();
		expect(browser.listenerCount()).toBe(0);
	});
});
