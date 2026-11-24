import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionModel, SessionTab } from "@/observer/page/types/index.js";
import TabPanel from "./index.js";

const model = {
	tree: { kind: "unavailable" },
	plans: null,
	board: { kind: "unavailable", tone: "calm", heading: "Board unavailable", text: "t", meta: null },
	record: { kind: "missing", message: "m" },
	sessions: [],
} as unknown as SessionModel;

function render(tab: SessionTab): string {
	return renderToStaticMarkup(
		<TabPanel tab={tab} model={model} now={new Date()} token="tok" projectKey="k" routeSessionId="s1" onOpen={() => undefined} />,
	);
}

describe("TabPanel", () => {
	it.each([
		["tree", "Intent tree unavailable"],
		["plans", "Plans and todos unavailable"],
		["board", "Board unavailable"],
		["record", "No session record"],
	] as const)("draws the %s tab's content in a tabpanel labelled by that tab", (tab, text) => {
		const html = render(tab);
		expect(html).toContain(`<div class="av-panel" role="tabpanel" id="session-panel" aria-labelledby="tab-${tab}">`);
		expect(html).toContain(text);
	});

	it("draws an empty list for the Sessions tab and nothing for History, which is its own column", () => {
		expect(render("sessions")).toContain('<div class="av-list"></div>');
		expect(render("history")).toBe('<div class="av-panel" role="tabpanel" id="session-panel" aria-labelledby="tab-history"></div>');
	});
});
