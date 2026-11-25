import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { StreamState } from "@/observer/page/types/index.js";
import useObserverStream from "@/observer/page/useObserverStream/index.js";
import App from "./index.js";

vi.mock("@/observer/page/useObserverStream/index.js", () => ({ default: vi.fn() }));

function stubBrowser({ narrow = false }: { narrow?: boolean } = {}): void {
	vi.stubGlobal("window", {
		localStorage: { getItem: () => null, setItem: () => undefined },
		matchMedia: (query: string) => ({
			matches: query.includes("max-width") ? narrow : false,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		}),
	});
}

function render({ pathname, search }: { pathname: string; search: string }): string {
	return renderToStaticMarkup(<App location={{ pathname, search }} />);
}

beforeEach(() => {
	stubBrowser();
	const state: StreamState = { connection: "live", held: [], views: {}, listings: {}, projects: [] };
	vi.mocked(useObserverStream).mockReset();
	vi.mocked(useObserverStream).mockReturnValue(state);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("App", () => {
	it("shows Home at / with the token", () => {
		const html = render({ pathname: "/", search: "?token=tok" });
		expect(html).toContain('<div class="av t-dark desk">');
		expect(html).toContain('<main id="main" class="av-home">');
		expect(useObserverStream).toHaveBeenCalledWith({ token: "tok" });
	});

	it("shows the session view at /p/:project/s/:session with the link's tab on the root, folding a phone-only tab to the tree on a wide screen", () => {
		const html = render({ pathname: "/p/app-abc123/s/s1", search: "?token=tok&tab=board" });
		expect(html).toContain('<div class="av t-dark desk tab-board">');
		expect(html).toContain('<section class="av-now" aria-label="Now running">');
		expect(html).toContain('id="tab-tree" aria-selected="true"');
		expect(html).toContain('id="tab-board" aria-selected="false"');
		expect(useObserverStream).toHaveBeenCalledWith({ token: "tok", projectKey: "app-abc123" });
	});

	it("selects the tab in the link on a narrow screen", () => {
		stubBrowser({ narrow: true });
		const html = render({ pathname: "/p/app-abc123/s/s1", search: "?token=tok&tab=board" });
		expect(html).toContain('<div class="av t-dark phone tab-board">');
		expect(html).toContain('id="tab-board" aria-selected="true"');
	});

	it("opens the detail the link names, docked in the side panel on a wide screen", () => {
		const html = render({ pathname: "/p/app-abc123/s/s1", search: "?token=tok&item=task%3Afix-it" });
		expect(html).toContain('<aside class="av-drawer docked"');
		expect(html).toContain("Task title");
	});

	it("carries the phone class and the History tab for a narrow screen", () => {
		stubBrowser({ narrow: true });
		const html = render({ pathname: "/p/app-abc123/s/s1", search: "?token=tok&tab=history" });
		expect(html).toContain('<div class="av t-dark phone tab-history">');
	});

	it.each([
		["no token at all", "/", ""],
		["an unknown path", "/nope", "?token=tok"],
		["a session link with no token", "/p/app-abc123/s/s1", ""],
	])("shows the invalid link for %s, with no pill, rail or data and no stream opened", (_, pathname, search) => {
		const html = render({ pathname, search });
		expect(stripMarkup(html)).toContain("This link is no longer valid");
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("av-rail");
		expect(html).not.toContain("av-side");
		expect(html).not.toContain("av-now");
		expect(useObserverStream).not.toHaveBeenCalled();
	});
});
