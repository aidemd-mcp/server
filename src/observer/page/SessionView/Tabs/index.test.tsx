import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TabModel } from "@/observer/page/types/index.js";
import Tabs from "./index.js";

const tabs: TabModel[] = [
	{ id: "tree", label: "Intent tree", icon: "tree", count: "2 misaligned", tone: "danger", phoneOnly: false },
	{ id: "plans", label: "Plans & todos", icon: "step", count: "7", tone: "default", phoneOnly: false },
	{ id: "board", label: "Board", icon: "board", count: null, tone: "default", phoneOnly: false },
	{ id: "history", label: "History", icon: "history", count: null, tone: "default", phoneOnly: true },
];

describe("Tabs", () => {
	const html = renderToStaticMarkup(<Tabs tabs={tabs} selected="plans" onPick={() => undefined} />);

	it("is a labelled tablist of tab buttons with the selected one marked", () => {
		expect(html).toContain('<div class="av-tabs" role="tablist" aria-label="Session views">');
		expect(html.match(/role="tab"/g)).toHaveLength(4);
		expect(html).toContain('id="tab-plans" aria-selected="true"');
		expect(html).toContain('id="tab-tree" aria-selected="false"');
		expect(html).toContain('aria-controls="session-panel"');
	});

	it("draws a glyph and label on every tab and a count only where there is one", () => {
		expect(html).toContain('<span class="ic i-tree" aria-hidden="true"></span>Intent tree');
		expect(html).toContain('<span class="n danger">2 misaligned</span>');
		expect(html).toContain('<span class="n">7</span>');
		expect(html.match(/class="n/g)).toHaveLength(2);
	});

	it("marks the History tab phone-only", () => {
		expect(html).toContain('class="only-phone"');
		expect(html.match(/only-phone/g)).toHaveLength(1);
	});
});
