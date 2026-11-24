import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SkipLink from "./index.js";

describe("SkipLink", () => {
	it("links to the target id with the skip copy", () => {
		expect(renderToStaticMarkup(<SkipLink target="main" />)).toBe('<a class="av-skip" href="#main">Skip to main content</a>');
	});
});
