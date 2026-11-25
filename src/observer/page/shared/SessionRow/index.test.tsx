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

function render({ row = makeRow(), actionError = null }: { row?: SessionRowModel; actionError?: string | null } = {}) {
	return renderToStaticMarkup(<SessionRow row={row} now={NOW} actionError={actionError} onArchive={() => undefined} />);
}

function renderArchived({
	confirming = false,
	error = null,
	actionError = null,
}: { confirming?: boolean; error?: string | null; actionError?: string | null } = {}) {
	return renderToStaticMarkup(
		<SessionRow
			row={makeRow()}
			now={NOW}
			archived
			actionError={actionError}
			confirming={confirming}
			error={error}
			onRestore={() => undefined}
			onAskDelete={() => undefined}
			onCancel={() => undefined}
			onDelete={() => undefined}
		/>,
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

	it("draws a live row with the live class, the Live badge and no Archive", () => {
		const html = render({ row: makeRow({ liveness: "live" }) });
		expect(html).toContain('class="av-srow live"');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Live</span>');
		expect(html).not.toContain("Archive");
	});

	it("draws an idle row with the outline Idle badge and no Archive", () => {
		const html = render({ row: makeRow({ liveness: "idle" }) });
		expect(html).toContain('class="av-srow"');
		expect(html).toContain('<span class="av-badge outline"><span class="ic i-idle" aria-hidden="true"></span>Idle</span>');
		expect(html).not.toContain("Archive");
	});

	it("draws an ended row with the Ended badge and a labelled Archive button, and no Delete", () => {
		const html = render();
		expect(html).toContain('<span class="av-badge neutral"><span class="ic i-power" aria-hidden="true"></span>Ended</span>');
		expect(html).toContain('<button type="button" class="av-btn" aria-label="Archive session Yesterday 16:40">Archive</button>');
		expect(html).not.toContain("Delete");
		expect(html).not.toContain("av-confirm");
	});

	it("shows a failed archive's message under the buttons, and nothing when there is none", () => {
		expect(render({ actionError: "Could not archive" })).toContain('<span class="meta s-err">Could not archive</span>');
		expect(render()).not.toContain("s-err");
	});

	it("draws an archived row with Restore and Delete permanently and no Archive or task line", () => {
		const html = renderArchived();
		expect(html).toContain('aria-label="Restore session Yesterday 16:40">Restore</button>');
		expect(html).toContain('aria-label="Delete history of session Yesterday 16:40 permanently"');
		expect(stripMarkup(html)).toContain("Delete permanently");
		expect(html).not.toContain(">Archive<");
		expect(stripMarkup(html)).not.toContain("Task");
		expect(html).not.toContain("av-confirm");
	});

	it("asks first with the exact copy, Cancel and Delete history", () => {
		const html = renderArchived({ confirming: true });
		expect(html).toContain('<div class="av-confirm" role="alertdialog" aria-label="Confirm delete">');
		expect(html).toContain('<span class="ic lg i-trash" aria-hidden="true" style="color:var(--danger)"></span>');
		expect(stripMarkup(html)).toContain("Delete this session's history? This can't be undone.");
		expect(html).toContain('<button type="button" class="av-btn">Cancel</button>');
		expect(html).toContain('<button type="button" class="av-btn danger-solid">Delete history</button>');
	});

	it("shows a failed delete's message as meta inside the confirmation, and nothing when there is none", () => {
		expect(renderArchived({ confirming: true, error: "Could not delete" })).toContain('<span class="meta">Could not delete</span>');
		expect(renderArchived({ confirming: true })).not.toContain("Could not delete");
		expect(renderArchived({ error: "Could not delete" })).not.toContain("Could not delete");
	});
});
