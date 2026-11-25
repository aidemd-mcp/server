import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HistoryKind, HistoryModel, HistoryRowModel, SessionRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: vi.fn(actual.useState) };
});

import { useState } from "react";
import BottomDrawer from "./index.js";

function row({ id, kind, label, time = "14:02", mono = null }: { id: string; kind: HistoryKind; label: string; time?: string; mono?: string | null }): HistoryRowModel {
	return { id, sessionId: "s1", time, day: "Today", kind, ...KIND_FACTS[kind], label, mono, meta: null, sessionTag: null, item: null, files: [] };
}

const HISTORY: HistoryModel = {
	rows: [
		row({ id: "s1:1", kind: "start", label: "Session started", time: "14:00" }),
		row({ id: "s1:2", kind: "phase", label: "Spec started", time: "14:02" }),
		row({ id: "s1:3", kind: "commit", label: "Commit", time: "14:09", mono: "414776f" }),
	],
	total: 3,
	sessions: [],
	counts: { sessions: 1, phases: 1, commits: 1 },
};

const SESSIONS: SessionRowModel[] = [{ sessionId: "s1", startedAt: "2026-11-23T14:00:00.000Z", lastEventAt: null, eventCount: 3, liveness: "live", task: null, label: null }];

function html({ history = HISTORY, sessions = SESSIONS, boardCount = "4" as string | null } = {}): string {
	return renderToStaticMarkup(
		<BottomDrawer
			history={history}
			sessions={<p>SESSIONS-PANEL</p>}
			board={<p>BOARD-PANEL</p>}
			counts={{ sessions: "2", board: boardCount }}
			onOpen={() => undefined}
			picker={{ sessions, current: "s1", now: NOW, onPick: () => undefined }}
		/>,
	);
}

/** Opens the drawer on a panel (and sets the order) by pinning the first useState calls, which are the drawer's own. */
function openOn(panel: "history" | "sessions" | "board", newest = true): void {
	vi.mocked(useState)
		.mockImplementationOnce(() => [panel, () => undefined] as never)
		.mockImplementationOnce(() => [newest, () => undefined] as never);
}

afterEach(() => {
	vi.mocked(useState).mockReset();
});

describe("BottomDrawer closed", () => {
	it("is one bar of three launcher tabs, each with its count, none selected", () => {
		const markup = html();
		expect(markup).toContain('<div class="av-histdrawer"><div class="av-histbar-row" role="tablist" aria-label="Bottom drawer">');
		expect(markup).toMatch(/<button type="button" role="tab" class="av-launch" aria-selected="false"><span class="ic i-history" aria-hidden="true"><\/span>History<span class="n">3<\/span><\/button>/);
		expect(markup).toMatch(/>Sessions<span class="n">2<\/span>/);
		expect(markup).toMatch(/>Board<span class="n">4<\/span>/);
		expect(markup).not.toContain('aria-selected="true"');
	});

	it("names the newest event in the bar", () => {
		const markup = html();
		expect(markup).toContain('<span class="hb-latest"><span class="mono">14:09</span> Commit<span class="mono"> 414776f</span></span>');
	});

	it("leaves the newest event empty for a history with no event, and leaves out a Board count that is null", () => {
		const markup = html({ history: { rows: [], total: 0, sessions: [], counts: {} }, boardCount: null });
		expect(markup).toContain('<span class="hb-latest"></span>');
		expect(markup).not.toMatch(/>Board<span/);
	});

	it("draws no panel and no Hide button", () => {
		const markup = html();
		expect(markup).not.toContain("av-histdrawer-b");
		expect(markup).not.toContain("hb-hide");
	});
});

describe("BottomDrawer open", () => {
	it("slides up on the History panel, marks its tab, and offers Hide", () => {
		openOn("history");
		const markup = html();
		expect(markup).toContain('<div class="av-histdrawer open">');
		expect(markup).toMatch(/role="tab" class="av-launch" aria-selected="true"><span class="ic i-history"/);
		expect(markup).toContain('<div class="av-histdrawer-b" role="tabpanel">');
		expect(markup).toContain("hb-hide");
		expect(markup).toContain("Hide");
	});

	it("holds the history list, with the session picker and the order switch pinned in its head and no header of its own", () => {
		openOn("history");
		const markup = html();
		expect(markup).toContain('<aside class="av-side" aria-label="History">');
		expect(markup).toContain('<div class="av-histhead"><div class="av-picker">');
		expect(markup).toContain('class="hh-order"');
		expect(markup).not.toContain("av-hist-h");
		expect(markup).not.toContain("Filter by type");
	});

	it("lists newest first and words the switch to go oldest first", () => {
		openOn("history", true);
		const markup = html();
		expect(markup.indexOf("Spec started")).toBeLessThan(markup.indexOf("Session started"));
		expect(markup).toContain('aria-label="Newest first; switch to oldest first"');
		expect(markup).toContain('Newest first<span aria-hidden="true">↓</span>');
	});

	it("lists oldest first and words the switch to go newest first", () => {
		openOn("history", false);
		const markup = html();
		expect(markup.indexOf("Session started")).toBeLessThan(markup.indexOf("Spec started"));
		expect(markup).toContain('aria-label="Oldest first; switch to newest first"');
		expect(markup).toContain('Oldest first<span aria-hidden="true">↑</span>');
	});

	it("leaves the session picker out when the project lists no session", () => {
		openOn("history");
		const markup = html({ sessions: [] });
		expect(markup).not.toContain("av-picker");
		expect(markup).toContain("hh-order");
	});

	it("shows the Sessions content in a padded panel", () => {
		openOn("sessions");
		const markup = html();
		expect(markup).toContain('<div class="av-drawer-pad"><p>SESSIONS-PANEL</p></div>');
		expect(markup).not.toContain("BOARD-PANEL");
		expect(markup).not.toContain('aria-label="History"');
		expect(markup).toMatch(/aria-selected="true"><span class="ic i-sessions"/);
	});

	it("shows the Board content in a padded panel", () => {
		openOn("board");
		const markup = html();
		expect(markup).toContain('<div class="av-drawer-pad"><p>BOARD-PANEL</p></div>');
		expect(markup).not.toContain("SESSIONS-PANEL");
	});
});
