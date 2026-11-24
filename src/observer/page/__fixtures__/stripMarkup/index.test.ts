import { describe, expect, it } from "vitest";
import stripMarkup from "./index.js";

describe("stripMarkup", () => {
	it("removes tags and React's text separators", () => {
		expect(stripMarkup('<b>42<!-- --> events</b><span class="led" aria-hidden="true"></span>')).toBe("42 events");
	});

	it("decodes the entities React writes", () => {
		expect(stripMarkup("<p>This can&#x27;t be &quot;undone&quot; &amp; &lt;done&gt;</p>")).toBe(`This can't be "undone" & <done>`);
	});
});
