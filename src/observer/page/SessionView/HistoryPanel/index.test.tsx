import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryModel, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import HistoryPanel from "./index.js";

function row({ id, kind, label, sessionId = "s1", sessionTag = null }: { id: string; kind: HistoryKind; label: string; sessionId?: string; sessionTag?: string | null }): HistoryRowModel {
	return {
		id,
		sessionId,
		time: "14:02",
		day: "Today",
		kind,
		...KIND_FACTS[kind],
		label,
		mono: null,
		meta: null,
		sessionTag,
		item: { kind: "event", sessionId, seq: 1 },
		files: [],
	};
}

const SINGLE: HistoryModel = {
	rows: [row({ id: "s1:1", kind: "start", label: "Session started" }), row({ id: "s1:2", kind: "phase", label: "Spec started" })],
	total: 2,
	sessions: [],
	counts: { sessions: 1, phases: 1 },
};

describe("HistoryPanel", () => {
	it("draws the heading with the event count, the order toggle and the type filters over the list, newest first", () => {
		const html = renderToStaticMarkup(<HistoryPanel history={SINGLE} onOpen={() => undefined} />);
		expect(html).toContain('<aside class="av-side" aria-label="History">');
		expect(html).toContain('<h2 class="av-h2"><span class="ic i-history" aria-hidden="true"></span>History <span class="n">2 events</span></h2>');
		expect(html).toContain(
			'<div class="av-seg" role="group" aria-label="Order"><button type="button" aria-pressed="true">Newest first</button><button type="button" aria-pressed="false">Oldest first</button></div>',
		);
		expect(html).toContain(
			'<div class="av-filters" role="group" aria-label="Filter by type"><button type="button" aria-pressed="true">All</button><button type="button" aria-pressed="false">Phases 1</button></div>',
		);
		expect(html).toContain('<li class="av-hday">Today · newest first</li>');
		expect(html.indexOf("Spec started")).toBeLessThan(html.indexOf("Session started"));
		expect(html).not.toContain("Filter by session");
		expect(html).not.toContain("av-empty");
	});

	it("draws the session filter and the session tags while two sessions share the history", () => {
		const history: HistoryModel = {
			rows: [row({ id: "a:1", kind: "phase", label: "Spec started", sessionId: "a", sessionTag: "14:02" }), row({ id: "b:1", kind: "phase", label: "Spec started", sessionId: "b", sessionTag: "15:30" })],
			total: 2,
			sessions: [
				{ id: "a", label: "14:02" },
				{ id: "b", label: "15:30" },
			],
			counts: { phases: 2 },
		};
		const html = renderToStaticMarkup(<HistoryPanel history={history} onOpen={() => undefined} />);
		expect(html).toContain(
			'<div class="av-seg" role="group" aria-label="Filter by session" style="margin-bottom:10px"><button type="button" aria-pressed="true">Both sessions</button><button type="button" aria-pressed="false">14:02</button><button type="button" aria-pressed="false">15:30</button></div>',
		);
		expect(html).toContain('<span class="av-hsess">14:02</span>');
		expect(html).toContain('<span class="av-hsess">15:30</span>');
	});

	it("says `No events yet.` with no events and counts one event in the singular", () => {
		const empty = renderToStaticMarkup(<HistoryPanel history={{ rows: [], total: 0, sessions: [], counts: {} }} onOpen={() => undefined} />);
		expect(empty).toContain('<p class="av-empty">No events yet.</p>');
		expect(empty).toContain('<span class="n">0 events</span>');
		const one = renderToStaticMarkup(<HistoryPanel history={{ ...SINGLE, total: 1 }} onOpen={() => undefined} />);
		expect(one).toContain('<span class="n">1 event</span>');
	});
});
