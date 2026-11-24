import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import SessionNotFound from "./index.js";

describe("SessionNotFound", () => {
	const html = renderToStaticMarkup(<SessionNotFound />);

	it("is one calm notice with the approved copy, not an error", () => {
		expect(html).toContain('class="av-notice calm"');
		expect(html).not.toContain("err");
		expect(stripMarkup(html)).toBe(
			"Session not foundThis observer has no recording of this session. It may have been deleted. Open All projects to see what is recorded.",
		);
	});

	it("is the page's main region, so the skip link lands on it", () => {
		expect(html).toContain('<main id="main" class="av-body">');
	});
});
