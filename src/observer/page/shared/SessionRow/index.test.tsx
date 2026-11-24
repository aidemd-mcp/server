import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import SessionRow from "./index.js";

const NOW = new Date(2026, 10, 23, 15, 0, 0);

function makeRow(overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return {
		sessionId: "s1",
		startedAt: new Date(2026, 10, 22, 16, 40, 0).toISOString(),
		lastEventAt: new Date(2026, 10, 22, 17, 28, 5).toISOString(),
		eventCount: 97,
		liveness: "ended",
		task: "Install writes .aide/intent.aide",
		label: null,
		...overrides,
	};
}

function render({
	row = makeRow(),
	confirming = false,
	error = null,
}: { row?: SessionRowModel; confirming?: boolean; error?: string | null } = {}) {
	return renderToStaticMarkup(
		<SessionRow row={row} now={NOW} confirming={confirming} error={error} onAskDelete={() => undefined} onCancel={() => undefined} onDelete={() => undefined} />,
	);
}

describe("SessionRow", () => {
	it("prints the start, span, event count and task of an ended session", () => {
		const text = stripMarkup(render());
		expect(text).toContain("Yesterday 16:40");
		expect(text).toContain("48m 05s · 97 events");
		expect(text).toContain("Task Install writes .aide/intent.aide");
	});

	it("says No task picked yet and singular event when there is no task and one event", () => {
		const text = stripMarkup(render({ row: makeRow({ task: null, eventCount: 1 }) }));
		expect(text).toContain("Task No task picked yet");
		expect(text).toContain("· 1 event");
		expect(text).not.toContain("1 events");
	});

	it("draws a live row with the live class, the Live badge and no Delete", () => {
		const html = render({ row: makeRow({ liveness: "live" }) });
		expect(html).toContain('class="av-srow live"');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Live</span>');
		expect(html).not.toContain("Delete");
	});

	it("draws an idle row with the outline Idle badge and no Delete", () => {
		const html = render({ row: makeRow({ liveness: "idle" }) });
		expect(html).toContain('class="av-srow"');
		expect(html).toContain('<span class="av-badge outline"><span class="ic i-idle" aria-hidden="true"></span>Idle</span>');
		expect(html).not.toContain("Delete");
	});

	it("draws an ended row with the Ended badge and a labelled Delete button", () => {
		const html = render();
		expect(html).toContain('<span class="av-badge neutral"><span class="ic i-power" aria-hidden="true"></span>Ended</span>');
		expect(html).toContain('aria-label="Delete history of session Yesterday 16:40"');
		expect(html).toContain('<button type="button" class="av-btn danger"');
		expect(html).not.toContain("av-confirm");
	});

	it("asks first with the exact copy, Cancel and Delete history", () => {
		const html = render({ confirming: true });
		expect(html).toContain('<div class="av-confirm" role="alertdialog" aria-label="Confirm delete">');
		expect(html).toContain('<span class="ic lg i-trash" aria-hidden="true" style="color:var(--danger)"></span>');
		expect(stripMarkup(html)).toContain("Delete this session's history? This can't be undone.");
		expect(html).toContain('<button type="button" class="av-btn">Cancel</button>');
		expect(html).toContain('<button type="button" class="av-btn danger-solid">Delete history</button>');
	});

	it("never opens the confirmation on a session that is not ended", () => {
		expect(render({ row: makeRow({ liveness: "live" }), confirming: true })).not.toContain("av-confirm");
		expect(render({ row: makeRow({ liveness: "idle" }), confirming: true })).not.toContain("av-confirm");
	});

	it("shows a failed delete's message as meta inside the confirmation, and nothing when there is none", () => {
		expect(render({ confirming: true, error: "Could not delete" })).toContain('<span class="meta">Could not delete</span>');
		expect(render({ confirming: true })).not.toContain("Could not delete");
		expect(render({ error: "Could not delete" })).not.toContain("Could not delete");
	});
});
