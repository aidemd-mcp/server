import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Markdown from "./index.js";

describe("Markdown", () => {
	it("renders paragraphs, lists, bold and code spans", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"Use **care** with `aide_init`.\n\n- one\n- two\n\n1. first"} />);
		expect(html).toBe(
			'<p>Use <b>care</b> with <span class="mono">aide_init</span>.</p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>',
		);
	});

	it("prints raw HTML as escaped text, never as elements", () => {
		const html = renderToStaticMarkup(<Markdown markdown={'<img src=x onerror="alert(1)"> and <script>x</script>'} />);
		expect(html).not.toContain("<img");
		expect(html).not.toContain("<script");
		expect(html).toContain("&lt;img");
		expect(html).toContain("&lt;script&gt;");
	});

	it("renders nothing for empty markdown", () => {
		expect(renderToStaticMarkup(<Markdown markdown="" />)).toBe("");
	});
});
