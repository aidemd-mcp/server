import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { RecordModel } from "@/observer/page/types/index.js";
import RecordView from "./index.js";

const PRESENT: RecordModel = {
	kind: "present",
	outline: [
		{ id: "rec-1", label: "Where this cycle stopped", pinned: true, count: "" },
		{ id: "rec-0", label: "State summary", pinned: false, count: "" },
		{ id: "rec-2", label: "Open questions", pinned: false, count: "" },
	],
	pinned: {
		id: "rec-1",
		heading: "Where this cycle stopped",
		markdown: "Between steps 8 and 9.",
		subsections: [{ heading: "What the next agent must do", markdown: "1. Build step 9\n2. Build step 10" }],
		empty: null,
	},
	sections: [
		{ id: "rec-0", heading: "State summary", markdown: "Steps 1-8 <b>done</b>.", subsections: [], empty: null },
		{ id: "rec-2", heading: "Open questions", markdown: "", subsections: [], empty: "No open questions recorded for this cycle." },
	],
};

describe("RecordView", () => {
	it("draws the outline as jump links, the first on, the pinned one with the pin icon", () => {
		const html = renderToStaticMarkup(<RecordView record={PRESENT} />);
		expect(html).toContain('<nav class="av-outline" aria-label="Record outline"><span class="o-h">Outline</span>');
		expect(html).toContain('<a href="#rec-1" class="on"><span class="ic i-pin pin" aria-hidden="true"></span>Where this cycle stopped<span class="c"></span></a>');
		expect(html).toContain('<a href="#rec-0">State summary<span class="c"></span></a>');
	});

	it("draws the pinned section first with its key, heading, markdown and subsection", () => {
		const html = renderToStaticMarkup(<RecordView record={PRESENT} />);
		expect(html).toContain('<article class="av-doc"><section class="av-pin" id="rec-1"><span class="pin-k"><span class="ic i-pin" aria-hidden="true"></span>Pinned</span><h3>Where this cycle stopped</h3>');
		expect(html).toContain("<h4>What the next agent must do</h4><ol><li>Build step 9</li><li>Build step 10</li></ol>");
		expect(html.indexOf('id="rec-1"')).toBeLessThan(html.indexOf('id="rec-0"'));
	});

	it("draws an empty section as the calm line and never as markup from its text", () => {
		const html = renderToStaticMarkup(<RecordView record={PRESENT} />);
		expect(html).toContain('<section id="rec-2"><h3>Open questions</h3><p class="av-empty">No open questions recorded for this cycle.</p></section>');
		expect(html).toContain("Steps 1-8 &lt;b&gt;done&lt;/b&gt;.");
		expect(html).not.toContain("<b>done</b>");
	});

	it("draws a record with no pinned section as just the sections", () => {
		const html = renderToStaticMarkup(<RecordView record={{ ...PRESENT, pinned: null, outline: PRESENT.kind === "present" ? PRESENT.outline.slice(1) : [] }} />);
		expect(html).not.toContain("av-pin");
		expect(html).toContain('<section id="rec-0">');
	});

	it.each([
		["missing" as const, ".aide/session.aide isn't there yet; it appears once the agent writes it."],
		["unreadable" as const, "EACCES"],
	])("draws a %s record as one calm notice with its message", (kind, message) => {
		const html = renderToStaticMarkup(<RecordView record={{ kind, message }} />);
		expect(html).toContain('class="av-notice calm"');
		expect(html).toContain("<h3>No session record</h3>");
		expect(stripMarkup(html)).toContain(message);
		expect(html).not.toContain("av-outline");
	});
});
