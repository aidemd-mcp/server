import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThemeContext from "@/observer/page/shared/ThemeContext/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import InvalidLink from "./index.js";

function render(theme: "dark" | "light") {
	return renderToStaticMarkup(
		<ThemeContext.Provider value={{ theme, toggle: () => undefined }}>
			<InvalidLink />
		</ThemeContext.Provider>,
	);
}

describe("InvalidLink", () => {
	it("shows the handoff's heading and both paragraphs verbatim", () => {
		const text = stripMarkup(render("dark"));
		expect(text).toContain("This link is no longer valid");
		expect(text).toContain(
			"The access link may have expired, or it was copied incompletely. Nothing is shown here so you don't mistake old data for live data.",
		);
		expect(text).toContain(
			"Ask the agent for a fresh viewer link — it prints one when a session starts — or open the most recent link it gave you.",
		);
	});

	it("draws the unlink icon at xl inside an uncoloured notice", () => {
		const html = render("dark");
		expect(html).toContain('<div class="av-notice"><span class="ic xl i-unlink"');
	});

	it("has the brand and theme button but no connection pill, rail or data", () => {
		const html = render("light");
		expect(html).toContain('class="av-brand"');
		expect(html).toContain('aria-label="Switch to dark theme"');
		expect(html).not.toContain("av-conn");
		expect(html).not.toContain("av-rail");
		expect(html).not.toContain("av-card");
	});

	it("carries the skip link and the main region it targets", () => {
		const html = render("dark");
		expect(html).toContain('<a class="av-skip" href="#main">');
		expect(html).toContain('<main id="main" class="av-body">');
	});
});
