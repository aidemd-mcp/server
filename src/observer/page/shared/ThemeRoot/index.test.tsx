import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import useThemeContext from "@/observer/page/shared/useThemeContext/index.js";
import ThemeRoot from "./index.js";

/** Stands in the browser globals the root reads: a stored theme, the light-scheme preference and the phone query. */
function stubBrowser({ stored, prefersLight, narrow }: { stored: string | null; prefersLight: boolean; narrow: boolean }) {
	vi.stubGlobal("window", {
		localStorage: { getItem: () => stored, setItem: () => undefined },
		matchMedia: (query: string) => ({
			matches: query.includes("max-width") ? narrow : prefersLight,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		}),
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ThemeRoot", () => {
	it("draws the dark desktop root without a tab class on Home", () => {
		stubBrowser({ stored: null, prefersLight: false, narrow: false });
		expect(renderToStaticMarkup(<ThemeRoot>x</ThemeRoot>)).toBe('<div class="av t-dark desk">x</div>');
	});

	it("follows the light colour scheme when nothing is stored, and adds the phone and tab classes", () => {
		stubBrowser({ stored: null, prefersLight: true, narrow: true });
		expect(renderToStaticMarkup(<ThemeRoot tab="board">x</ThemeRoot>)).toBe('<div class="av t-light phone tab-board">x</div>');
	});

	it("lets the stored choice win over the colour scheme", () => {
		stubBrowser({ stored: "dark", prefersLight: true, narrow: false });
		expect(renderToStaticMarkup(<ThemeRoot>x</ThemeRoot>)).toContain("t-dark");
	});

	it("provides the theme to the screens below it", () => {
		stubBrowser({ stored: "light", prefersLight: false, narrow: false });
		function Screen() {
			return <>{useThemeContext().theme}</>;
		}
		expect(renderToStaticMarkup(<ThemeRoot><Screen /></ThemeRoot>)).toBe('<div class="av t-light desk">light</div>');
	});
});
