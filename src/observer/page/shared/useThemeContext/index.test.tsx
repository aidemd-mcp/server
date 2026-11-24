import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import useThemeContext from "./index.js";

function Probe() {
	return <>{useThemeContext().theme}</>;
}

describe("useThemeContext", () => {
	it("returns what the provider holds", () => {
		const html = renderToStaticMarkup(
			<ThemeContext.Provider value={{ theme: "light", toggle: () => undefined }}>
				<Probe />
			</ThemeContext.Provider>,
		);
		expect(html).toBe("light");
	});

	it("throws outside a provider instead of guessing a theme", () => {
		expect(() => renderToStaticMarkup(<Probe />)).toThrow("useThemeContext needs a ThemeRoot above it.");
	});
});
