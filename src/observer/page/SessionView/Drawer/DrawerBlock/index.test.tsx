import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawerBlockModel } from "@/observer/page/types/index.js";
import DrawerBlock from "./index.js";

const BASE = { heading: "Heading", icon: "doc", badge: null } as const;
const html = (block: DrawerBlockModel) => renderToStaticMarkup(<DrawerBlock block={block} />);

describe("DrawerBlock", () => {
	it("opens with an h4 of the icon and heading, and a badge when there is one", () => {
		expect(html({ ...BASE, type: "pre", text: "x" })).toMatch(/^<section><h4><span class="ic i-doc" aria-hidden="true"><\/span>Heading<\/h4>/);
		expect(html({ ...BASE, badge: { text: "approved · 3/9", tone: "run" }, type: "pre", text: "x" })).toContain('Heading<span class="av-badge run">approved · 3/9</span></h4>');
	});

	it("draws frontmatter as a definition list, a list value under its row with the handoff's spacing", () => {
		const markup = html({
			...BASE,
			type: "fm",
			rows: [
				{ key: "intent", value: "Point the agent.", list: null },
				{ key: "desired", value: "", list: ["a", "b"] },
			],
		});
		expect(markup).toContain('<dl class="av-fm"><dt>intent</dt><dd>Point the agent.</dd><dt>desired</dt><dd><ul class="out" style="margin-top:2px"><li>a</li><li>b</li></ul></dd></dl>');
	});

	it("draws paragraphs with the handoff's spacing and their inline markdown", () => {
		expect(html({ ...BASE, type: "text", paras: ["Run `aide_score` **now**"] })).toContain(
			'<p style="margin-bottom:8px">Run <code class="mono">aide_score</code> <b>now</b></p>',
		);
	});

	it("draws a list as ul.out", () => {
		expect(html({ ...BASE, type: "list", items: ["one", "two"] })).toContain('<ul class="out"><li>one</li><li>two</li></ul>');
	});

	it("draws a pre as av-pre and prints raw markup as text", () => {
		const markup = html({ ...BASE, type: "pre", text: "<b>x</b>\nline 2" });
		expect(markup).toContain('<div class="av-pre">&lt;b&gt;x&lt;/b&gt;\nline 2</div>');
	});

	it("draws key-value rows, mono only where marked", () => {
		const markup = html({
			...BASE,
			type: "kv",
			rows: [
				{ key: "Session", value: "Today 14:02 (this session)", mono: false },
				{ key: "Module", value: "src/tools/score", mono: true },
			],
		});
		expect(markup).toContain('<dl class="av-kv"><dt>Session</dt><dd>Today 14:02 (this session)</dd><dt>Module</dt><dd class="mono">src/tools/score</dd></dl>');
	});

	it("draws plan steps with on, sub and cur, the box icon only when done, and the state in words", () => {
		const markup = html({
			...BASE,
			type: "check",
			items: [
				{ no: "1", text: "Done step", done: true, sub: false, current: false },
				{ no: "2a", text: "Sub step", done: true, sub: true, current: false },
				{ no: "4", text: "Current step", done: false, sub: false, current: true },
				{ no: "5", text: "Later step", done: false, sub: false, current: false },
			],
		});
		expect(markup).toContain('<ol class="av-check">');
		expect(markup).toContain('<li class="on"><span class="ck" aria-hidden="true"><span class="ic i-check" aria-hidden="true"></span></span><span class="no">1</span><span class="tx">Done step<span class="sr"> (done)</span></span></li>');
		expect(markup).toContain('<li class="on sub">');
		expect(markup).toContain('<li class="cur"><span class="ck" aria-hidden="true"></span><span class="no">4</span><span class="tx">Current step<span class="sr"> (in progress)</span></span></li>');
		expect(markup).toContain('<li><span class="ck" aria-hidden="true"></span><span class="no">5</span><span class="tx">Later step<span class="sr"> (not done)</span></span></li>');
	});

	it("draws todo issues with the location, what is wrong and fixed or open in words", () => {
		const markup = html({
			...BASE,
			type: "issues",
			items: [
				{ loc: "rank.ts:42", text: "Ties fall back", done: false },
				{ loc: "weights.ts:9", text: "Not frozen", done: true },
				{ loc: "", text: "No location", done: false },
			],
		});
		expect(markup).toContain('<li class="issue"><span class="ck" aria-hidden="true"></span><span><span class="loc">rank.ts:42</span><span class="what">Ties fall back<span class="sr"> (open)</span></span></span></li>');
		expect(markup).toContain('<li class="issue on"><span class="ck" aria-hidden="true"><span class="ic i-check" aria-hidden="true"></span></span><span><span class="loc">weights.ts:9</span><span class="what">Not frozen<span class="sr"> (fixed)</span></span></span></li>');
		expect(markup).toContain('<li class="issue"><span class="ck" aria-hidden="true"></span><span><span class="what">No location');
	});
});
