import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppHeader from "./index.js";

describe("AppHeader", () => {
	it("places left and right content in the header's two groups", () => {
		expect(renderToStaticMarkup(<AppHeader left={<b>L</b>} right={<i>R</i>} />)).toBe(
			'<header class="av-hdr"><div class="av-hdr-l"><b>L</b></div><div class="av-hdr-r"><i>R</i></div></header>',
		);
	});
});
