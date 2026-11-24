import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Icon from "./index.js";

describe("Icon", () => {
	it("renders the base icon hidden from assistive technology", () => {
		expect(renderToStaticMarkup(<Icon name="run" />)).toBe('<span class="ic i-run" aria-hidden="true"></span>');
	});

	it.each([
		["lg", "ic lg i-sun"],
		["xl", "ic xl i-unlink"],
	] as const)("adds the %s size class", (size, expected) => {
		const name = size === "lg" ? "sun" : "unlink";
		expect(renderToStaticMarkup(<Icon name={name} size={size} />)).toContain(`class="${expected}"`);
	});

	it("sets a caller style through the style prop and none otherwise", () => {
		expect(renderToStaticMarkup(<Icon name="run" style={{ color: "var(--run)" }} />)).toBe(
			'<span class="ic i-run" aria-hidden="true" style="color:var(--run)"></span>',
		);
		expect(renderToStaticMarkup(<Icon name="run" />)).not.toContain("style");
	});

	it("adds spin and a caller class after the icon class", () => {
		const html = renderToStaticMarkup(<Icon name="reconnect" size="lg" spin className="extra" />);
		expect(html).toContain('class="ic lg i-reconnect spin extra"');
	});
});
