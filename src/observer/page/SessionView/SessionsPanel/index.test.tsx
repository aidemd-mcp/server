import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { DeleteConfirm, SessionRowModel } from "@/observer/page/types/index.js";
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

function render(rows: SessionRowModel[], confirm: DeleteConfirm = { sessionId: null, error: null }): string {
	return renderToStaticMarkup(<SessionsPanel rows={rows} now={NOW} token="t" projectKey="p" routeSessionId="live" confirm={confirm} onConfirmChange={() => undefined} />);
}

describe("SessionsPanel", () => {
	it("draws every row in the order given inside one av-list", () => {
		const html = render([makeRow("live"), makeRow("old", { liveness: "ended", startedAt: new Date(2026, 10, 22, 16, 40, 0).toISOString() })]);
		expect(html.startsWith('<div class="av-list">')).toBe(true);
		expect(html.match(/class="av-srow/g)).toHaveLength(2);
		const text = stripMarkup(html);
		expect(text.indexOf("Today 14:02")).toBeLessThan(text.indexOf("Yesterday 16:40"));
	});

	it("offers Delete on the ended row only and draws no confirmation until asked", () => {
		const html = render([makeRow("live"), makeRow("idle", { liveness: "idle" }), makeRow("old", { liveness: "ended" })]);
		expect(html.match(/class="av-btn danger"/g)).toHaveLength(1);
		expect(html).not.toContain("Confirm delete");
		expect(html).not.toContain("Cancel");
	});

	it("draws the confirmation on the one row the caller says is confirming, with its failure message", () => {
		const rows = [makeRow("old", { liveness: "ended" }), makeRow("older", { liveness: "ended" })];
		const html = render(rows, { sessionId: "old", error: "Could not delete" });
		expect(html.match(/Confirm delete|Delete history/g)?.length).toBeGreaterThan(0);
		expect(html).toContain("Could not delete");
		expect(html.match(/Cancel/g)).toHaveLength(1);
	});

	it("draws an empty list for a project with no sessions", () => {
		expect(render([])).toBe('<div class="av-list"></div>');
	});
});
