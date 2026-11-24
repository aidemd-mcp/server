import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { LiveRowModel } from "@/observer/page/types/index.js";
import LiveRow from "./index.js";

function makeRow(overrides: Partial<LiveRowModel> = {}): LiveRowModel {
	return {
		key: "k",
		project: "aidemd-mcp",
		start: "14:02",
		badge: { word: "Build · step 4 of 9", className: "run", icon: "run" },
		module: "src/tools/score",
		agent: "aide-implementor",
		elapsed: "7m 55s",
		href: "/p/a/s/b?token=t",
		...overrides,
	};
}

const render = (row: LiveRowModel) => renderToStaticMarkup(<LiveRow row={row} onOpen={() => undefined} />);

describe("LiveRow", () => {
	it("is a real button with project, session start, badge, module, agent and elapsed time", () => {
		const html = render(makeRow());
		expect(html).toContain('<button type="button" class="av-live-row">');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Build · step 4 of 9</span>');
		expect(html).toContain('<span class="lr-t">7m 55s</span>');
		expect(stripMarkup(html)).toContain("aidemd-mcp");
		expect(stripMarkup(html)).toContain("session 14:02");
		expect(stripMarkup(html)).toContain("src/tools/score");
		expect(stripMarkup(html)).toContain("by");
		expect(stripMarkup(html)).toContain("aide-implementor");
	});

	it("draws the waiting badge with the wait class and icon", () => {
		const html = render(makeRow({ badge: { word: "Waiting on you", className: "wait", icon: "wait" }, agent: null, elapsed: "6m" }));
		expect(html).toContain('<span class="av-badge wait"><span class="ic i-wait" aria-hidden="true"></span>Waiting on you</span>');
	});

	it("leaves module, agent and the 'by' out when none is reported", () => {
		const html = render(makeRow({ badge: { word: "No phase running", className: "neutral", icon: "idle" }, module: null, agent: null, elapsed: null }));
		expect(stripMarkup(html)).toContain("No phase running");
		expect(html).not.toContain("mono");
		expect(html).not.toContain(">by<");
		expect(html).toContain('<span class="lr-t"></span>');
	});
});
