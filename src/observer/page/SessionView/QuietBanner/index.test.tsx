import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import QuietBanner from "./index.js";

describe("QuietBanner", () => {
	it("is a quiet status region with the spinning reconnect icon, not an alert", () => {
		const html = renderToStaticMarkup(<QuietBanner lastUpdate="14:31:07" />);
		expect(html).toContain('<div class="av-quiet-banner" role="status">');
		expect(html).toContain('<span class="ic lg i-reconnect spin" aria-hidden="true"></span>');
		expect(html).not.toContain('role="alert"');
	});

	it("reads the handoff's sentence with the last update", () => {
		const text = stripMarkup(renderToStaticMarkup(<QuietBanner lastUpdate="14:31:07" />));
		expect(text).toBe(
			"Reconnecting… The viewer server restarted. This page reconnects by itself and nothing is lost — events from the gap appear when it's back. Last update 14:31:07.",
		);
	});

	it("leaves out the last-update clause when no event is held", () => {
		const text = stripMarkup(renderToStaticMarkup(<QuietBanner lastUpdate={null} />));
		expect(text).toBe("Reconnecting… The viewer server restarted. This page reconnects by itself and nothing is lost — events from the gap appear when it's back.");
	});

	it("bolds only the word Reconnecting", () => {
		expect(renderToStaticMarkup(<QuietBanner lastUpdate={null} />)).toContain("<b>Reconnecting…</b>");
	});
});
