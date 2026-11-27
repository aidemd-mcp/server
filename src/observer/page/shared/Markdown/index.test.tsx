import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Markdown from "./index.js";

describe("Markdown", () => {
	it("renders paragraphs, lists, bold and code spans", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"Use **care** with `aide_init`.\n\n- one\n- two\n\n1. first"} />);
		expect(html).toBe(
			'<p>Use <b>care</b> with <code class="mono">aide_init</code>.</p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>',
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

	it("draws headings as level-classed paragraphs, capped at level 4", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"# One\n\n## Two\n\n###### Six with **bold**"} />);
		expect(html).toBe('<p class="md-h l1">One</p><p class="md-h l2">Two</p><p class="md-h l4">Six with <b>bold</b></p>');
	});

	it("draws a fenced code block as one pre, exactly as written and escaped", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"```ts\nconst a = '<b>';\n\n  indented\n```"} />);
		expect(html).toBe('<pre class="av-pre md-code">const a = &#x27;&lt;b&gt;&#x27;;\n\n  indented</pre>');
	});

	it("does not read markdown inside a code block", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"```\n- **not** a list\n```"} />);
		expect(html).toContain("- **not** a list");
		expect(html).not.toContain("<ul");
		expect(html).not.toContain("<b>");
	});

	it("draws [ ] and [x] items as checkboxes, saying Open or Done in words for screen readers", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"- [ ] write it\n- [x] ship **it**\n- [X] also done\n- plain"} />);
		expect(html).toContain('<li><span class="md-check"><span class="box" aria-hidden="true"></span><span class="sr">Open: </span><span class="t">write it</span></span></li>');
		expect(html).toContain('<li><span class="md-check on"><span class="box" aria-hidden="true"></span><span class="sr">Done: </span><span class="t">ship <b>it</b></span></span></li>');
		expect(html).toContain('<span class="md-check on"><span class="box" aria-hidden="true"></span><span class="sr">Done: </span><span class="t">also done</span></span>');
		expect(html).toContain("<li>plain</li>");
	});

	it("draws checkbox items in a numbered list too", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"1. [x] first"} />);
		expect(html).toContain('<ol><li><span class="md-check on">');
	});

	it("does not draw a checkbox for brackets that are not at the start of the item", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"- see [x] later\n- [] empty"} />);
		expect(html).not.toContain("md-check");
	});

	it("draws a nested list and a later paragraph inside their item, after the item's checkbox", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"- [ ] Create it:\n  - one\n    - deeper\n  Then `this`.\n- [x] Done"} />);
		expect(html).toBe(
			'<ul><li><span class="md-check"><span class="box" aria-hidden="true"></span><span class="sr">Open: </span><span class="t">Create it:</span></span>' +
				"<ul><li>one<ul><li>deeper</li></ul></li></ul>" +
				'<p>Then <code class="mono">this</code>.</p></li>' +
				'<li><span class="md-check on"><span class="box" aria-hidden="true"></span><span class="sr">Done: </span><span class="t">Done</span></span></li></ul>',
		);
	});

	it("draws a pipe table in its own wrapper, with column alignment and inline markdown in cells", () => {
		const html = renderToStaticMarkup(<Markdown markdown={"| Name | Steps |\n|---|--:|\n| `rank` | **2** |"} />);
		expect(html).toBe(
			'<div class="md-table"><table><thead><tr><th>Name</th><th style="text-align:right">Steps</th></tr></thead>' +
				'<tbody><tr><td><code class="mono">rank</code></td><td style="text-align:right"><b>2</b></td></tr></tbody></table></div>',
		);
	});
});
