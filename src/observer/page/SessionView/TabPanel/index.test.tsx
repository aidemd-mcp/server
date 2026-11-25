import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionModel, SessionTab } from "@/observer/page/types/index.js";
import TabPanel from "./index.js";

const model = {
	header: { rootPath: "/work/app", kanbanTag: "app" },
	tree: { kind: "unavailable" },
	plans: null,
	board: { kind: "unavailable", tone: "calm", heading: "Board unavailable", text: "t", meta: null },
	record: { kind: "missing", message: "m" },
	sessions: [],
} as unknown as SessionModel;

function render(tab: SessionTab, session: SessionModel = model): string {
	return renderToStaticMarkup(
		<TabPanel tab={tab} model={session} now={new Date()} token="tok" projectKey="k" routeSessionId="s1" onOpen={() => undefined} />,
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

	it("draws the project's folder and kanban tag above the sessions list on the Sessions tab", () => {
		const html = render("sessions");
		expect(html).toContain('<div class="av-projinfo">');
		expect(html).toContain("/work/app");
		expect(html).toContain("Kanban tag");
		expect(html.indexOf("av-projinfo")).toBeLessThan(html.indexOf('<div class="av-list">'));
		expect(html).toContain('<div class="av-list"></div>');
	});

	it("draws no project info on the Sessions tab when the stream reported neither the folder nor the tag", () => {
		const bare = { ...model, header: { rootPath: null, kanbanTag: null } } as unknown as SessionModel;
		expect(render("sessions", bare)).not.toContain("av-projinfo");
	});

	it("draws nothing for History, which is its own column", () => {
		expect(render("history")).toBe('<div class="av-panel" role="tabpanel" id="session-panel" aria-labelledby="tab-history"></div>');
	});
});
