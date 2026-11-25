import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import SessionsPanel from "./index.js";

const NOW = new Date(2026, 10, 23, 15, 0, 0);

function makeRow(sessionId: string, overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return {
		sessionId,
		startedAt: new Date(2026, 10, 23, 14, 2, 0).toISOString(),
		lastEventAt: new Date(2026, 10, 23, 14, 5, 10).toISOString(),
		eventCount: 2,
		liveness: "live",
		task: null,
		label: null,
		...overrides,
	};
}

function render(rows: SessionRowModel[]): string {
	return renderToStaticMarkup(<SessionsPanel rows={rows} now={NOW} token="t" projectKey="p" routeSessionId="live" />);
}

describe("SessionsPanel", () => {
	it("draws every row in the order given inside one av-list", () => {
		const html = render([makeRow("live"), makeRow("old", { liveness: "ended", startedAt: new Date(2026, 10, 22, 16, 40, 0).toISOString() })]);
		expect(html.startsWith('<div class="av-list">')).toBe(true);
		expect(html.match(/class="av-srow/g)).toHaveLength(2);
		const text = stripMarkup(html);
		expect(text.indexOf("Today 14:02")).toBeLessThan(text.indexOf("Yesterday 16:40"));
	});

	it("offers Archive on the ended row only, never Delete, and draws no confirmation", () => {
		const html = render([makeRow("live"), makeRow("idle", { liveness: "idle" }), makeRow("old", { liveness: "ended" })]);
		expect(html.match(/>Archive<\/button>/g)).toHaveLength(1);
		expect(html).not.toContain("Delete");
		expect(html).not.toContain("av-confirm");
	});

	it("shows a collapsed Show archived toggle and draws no archived list until it is opened", () => {
		const html = render([makeRow("old", { liveness: "ended" })]);
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain("Show archived");
		expect(html).not.toContain("Restore");
		expect(html).not.toContain("Loading archived sessions");
	});

	it("draws an empty list for a project with no sessions", () => {
		expect(render([]).startsWith('<div class="av-list"></div>')).toBe(true);
	});
});
