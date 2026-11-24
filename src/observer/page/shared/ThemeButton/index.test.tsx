import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThemeButton from "./index.js";

describe("ThemeButton", () => {
	it("on dark offers the light theme with a sun", () => {
		const html = renderToStaticMarkup(<ThemeButton theme="dark" onToggle={() => undefined} />);
		expect(html).toContain('aria-label="Switch to light theme"');
		expect(html).toContain("i-sun");
		expect(html).toContain('class="av-btn icon"');
	});

	it("on light offers the dark theme with a moon", () => {
		const html = renderToStaticMarkup(<ThemeButton theme="light" onToggle={() => undefined} />);
		expect(html).toContain('aria-label="Switch to dark theme"');
		expect(html).toContain("i-moon");
	});

	it("is a real button that does not submit", () => {
		expect(renderToStaticMarkup(<ThemeButton theme="dark" onToggle={() => undefined} />)).toMatch(/^<button type="button"/);
	});
});
