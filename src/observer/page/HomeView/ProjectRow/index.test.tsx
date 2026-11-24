import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { ProjectRowModel, SessionRowModel } from "@/observer/page/types/index.js";
import ProjectRow from "./index.js";

const NOW = new Date(2026, 10, 23, 15, 0, 0);

function makeSession(overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return {
		sessionId: "s1",
		startedAt: new Date(2026, 10, 23, 14, 2, 0).toISOString(),
		lastEventAt: new Date(2026, 10, 23, 14, 12, 0).toISOString(),
		eventCount: 12,
		liveness: "ended",
		task: "Respect crawl-delay",
		label: null,
		...overrides,
	};
}

function makeProject(overrides: Partial<ProjectRowModel> = {}): ProjectRowModel {
	return {
		projectKey: "lead-crawler-111111",
		name: "lead-crawler",
		root: "~/code/lead-crawler",
		kanbanTag: "crawler",
		liveCount: 0,
		waiting: false,
		lastEventAt: null,
		lastActivity: "1m ago",
		rows: [makeSession()],
		openHref: "/p/lead-crawler-111111/s/s1?token=t",
		...overrides,
	};
}

function render({
	project = makeProject(),
	open = false,
	confirmingId = null,
	error = null,
}: { project?: ProjectRowModel; open?: boolean; confirmingId?: string | null; error?: string | null } = {}) {
	return renderToStaticMarkup(
		<ProjectRow
			project={project}
			open={open}
			now={NOW}
			confirmingId={confirmingId}
			error={error}
			onToggle={() => undefined}
			onOpen={() => undefined}
			onAskDelete={() => undefined}
			onCancel={() => undefined}
			onDelete={() => undefined}
		/>,
	);
}

describe("ProjectRow", () => {
	it("draws a closed project with a real header button, name, root, tag chip and last activity, and no body", () => {
		const html = render();
		expect(html).toContain('<div class="av-proj">');
		expect(html).toContain('<button type="button" class="av-proj-h" aria-expanded="false">');
		expect(html).toContain('<span class="ic lg i-chev-r" aria-hidden="true"></span>');
		expect(html).toContain('<span class="p-root">~/code/lead-crawler</span>');
		expect(html).toContain('<span class="p-tag av-chip"><span class="ic i-board" aria-hidden="true"></span>crawler</span>');
		expect(html).toContain('<span class="p-last">1m ago</span>');
		expect(html).not.toContain("av-proj-body");
	});

	it("draws an open project with the down chevron, its sessions and the Open link", () => {
		const html = render({ open: true });
		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain('<span class="ic lg i-chev-d" aria-hidden="true"></span>');
		expect(html).toContain('<div class="av-proj-body"><div class="av-list"><div class="av-srow">');
		expect(html).toContain('<div style="margin-top:10px"><button type="button" class="av-linkbtn">Open lead-crawler →</button></div>');
	});

	it("shows the live count badge and, while a gate is open, the waiting class and badge", () => {
		const html = render({ project: makeProject({ liveCount: 2, waiting: true }) });
		expect(html).toContain('<div class="av-proj waiting">');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>2 live</span>');
		expect(html).toContain('<span class="av-badge wait"><span class="ic i-wait" aria-hidden="true"></span>Waiting on you</span>');
	});

	it("shows neither badge for a quiet project", () => {
		const html = render();
		expect(html).not.toContain("av-badge run");
		expect(html).not.toContain("av-badge wait");
	});

	it("says No folder reported in the grey text, and leaves the tag chip out when none is known", () => {
		const html = render({ project: makeProject({ root: null, kanbanTag: null }) });
		expect(stripMarkup(html)).toContain("No folder reported");
		expect(html).toContain('<span class="t3"');
		expect(html).not.toContain("av-chip");
		expect(html).toContain('<span class="p-tag"></span>');
	});

	it("leaves the Open link out when the project has no session", () => {
		const html = render({ open: true, project: makeProject({ rows: [], openHref: null }) });
		expect(html).toContain('<div class="av-proj-body"></div>');
	});

	it("opens the delete confirmation on only the confirming session and shows its error there", () => {
		const project = makeProject({ rows: [makeSession({ sessionId: "s1" }), makeSession({ sessionId: "s2" })] });
		const html = render({ open: true, project, confirmingId: "s2", error: "Could not delete" });
		expect(html.match(/av-confirm/g)).toHaveLength(1);
		expect(html).toContain('<span class="meta">Could not delete</span>');
	});
});
