import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { LiveRowModel, ProjectRowModel, RailCell } from "@/observer/page/types/index.js";
import ProjectRow from "./index.js";

vi.mock("./TaskSummary/index.js", () => ({
	default: ({ slug, title, href }: { slug: string; title: string; href: string }) => <div className="stub-task" data-slug={slug} data-href={href}>{title}</div>,
}));

const BADGE: LiveRowModel["badge"] = { word: "Build", className: "run", icon: "run" };

const RAIL: RailCell[] = [
	{ name: "Spec", state: "done", meta: "Done", loop: null },
	{ name: "Build", state: "run", meta: "4m", loop: null },
];

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
		rows: [],
		openHref: "/p/lead-crawler-111111/s/s1?token=t",
		...overrides,
	};
}

function render({
	project = makeProject(),
	open = false,
	starred = false,
	drag = null,
}: { project?: ProjectRowModel; open?: boolean; starred?: boolean; drag?: { onDragStart(): void; onDrop(): void } | null } = {}) {
	return renderToStaticMarkup(
		<ProjectRow
			project={project}
			open={open}
			token="tok"
			starred={starred}
			onStar={() => undefined}
			drag={drag}
			onToggle={() => undefined}
			onOpen={() => undefined}
			onOpenHref={() => undefined}
		/>,
	);
}

describe("ProjectRow", () => {
	it("draws a closed project with its star, a real header button, the name, the last activity and an Open project button, and no body", () => {
		const html = render();
		expect(html).toContain('class="av-proj home"');
		expect(html).toContain('data-flip="lead-crawler-111111"');
		expect(html).toContain('<button type="button" class="av-proj-h flat" aria-expanded="false">');
		expect(html).toContain('<span class="ic i-chev-r" aria-hidden="true"></span>');
		expect(html).toContain('<span class="p-name">lead-crawler</span>');
		expect(html).toContain('<span class="p-last">1m ago</span>');
		expect(html).toContain('<button type="button" class="av-btn p-open">Open project<span class="ic i-chev-r" aria-hidden="true"></span></button>');
		expect(html).not.toContain("av-proj-more");
	});

	it("shows the star as an unpressed Star button, and as a pressed Unstar button once starred", () => {
		const plain = render();
		expect(plain).toContain('<button type="button" class="p-star" aria-pressed="false" aria-label="Star lead-crawler" title="Star">☆</button>');
		const starred = render({ starred: true });
		expect(starred).toContain('<button type="button" class="p-star on" aria-pressed="true" aria-label="Unstar lead-crawler" title="Unstar">★</button>');
	});

	it("draws an open project with the down chevron, the task and the phase rail", () => {
		const html = render({
			open: true,
			project: makeProject({ task: "Respect crawl-delay", taskSlug: "respect-crawl-delay", taskHref: "/p/k/s/s1?token=t&item=task%3Arespect-crawl-delay", rail: RAIL }),
		});
		expect(html).toContain('class="av-proj home open"');
		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain('<span class="ic i-chev-d" aria-hidden="true"></span>');
		expect(html).toContain('<div class="av-proj-more">');
		expect(html).toContain('<div class="stub-task" data-slug="respect-crawl-delay" data-href="/p/k/s/s1?token=t&amp;item=task%3Arespect-crawl-delay">Respect crawl-delay</div>');
		expect(html).toContain('<div class="pm-rail">');
		expect(html).toContain('class="av-rail"');
	});

	it("shows the current task's title under the name while closed", () => {
		const html = render({ project: makeProject({ task: "Respect crawl-delay" }) });
		expect(html).toContain('<span class="p-task">Respect crawl-delay</span>');
	});

	it("says so in an open row when no task was reported or no session is running", () => {
		const html = render({ open: true });
		expect(stripMarkup(html)).toContain("No task reported by this session.");
		expect(stripMarkup(html)).toContain("No session is running in this project.");
		expect(html).not.toContain("stub-task");
		expect(html).not.toContain("pm-rail");
	});

	it("needs the task's slug and link as well as its title before it draws the task", () => {
		const html = render({ open: true, project: makeProject({ task: "Respect crawl-delay", taskSlug: null, taskHref: null, rail: RAIL }) });
		expect(html).not.toContain("stub-task");
		expect(stripMarkup(html)).toContain("No task reported by this session.");
		expect(html).toContain("pm-rail");
	});

	it("shows the phase badge with its elapsed time while a session runs, and nothing in that place when none does", () => {
		const running = render({ project: makeProject({ status: { key: "k", project: "p", start: "s", badge: BADGE, phase: null, pipeline: null, outside: false, module: null, agent: null, elapsed: "4m", href: "/x" } }) });
		expect(running).toContain('<span class="p-now"><span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>Build</span><span class="p-el mono">4m</span></span>');
		expect(render()).toContain('<span class="p-now"></span>');
	});

	it("shows the pipeline and the phase in the status line, and the pipeline in the open row's rail footer", () => {
		const status = { key: "k", project: "p", start: "s", badge: BADGE, phase: "Build · step 4 of 9", pipeline: "feature-x", outside: false, module: null, agent: null, elapsed: "4m", href: "/x" };
		const closed = stripMarkup(render({ project: makeProject({ status }) }));
		expect(closed).toContain("feature-x");
		expect(closed).toContain("Build · step 4 of 9");
		const open = stripMarkup(render({ open: true, project: makeProject({ status, rail: RAIL }) }));
		expect(open).toContain("Pipeline feature-x");
	});

	it("says Working outside the pipeline in the status line and the rail footer for a session outside it", () => {
		const status = { key: "k", project: "p", start: "s", badge: BADGE, phase: "Working outside the pipeline", pipeline: null, outside: true, module: null, agent: null, elapsed: null, href: "/x" };
		expect(stripMarkup(render({ project: makeProject({ status }) }))).toContain("Working outside the pipeline");
		expect(stripMarkup(render({ open: true, project: makeProject({ status, rail: RAIL }) }))).toContain("Working outside the pipeline");
	});

	it("shows the live count badge and, while a gate is open, the waiting class", () => {
		const html = render({ project: makeProject({ liveCount: 2, waiting: true }) });
		expect(html).toContain('class="av-proj home waiting"');
		expect(html).toContain('<span class="av-badge run"><span class="ic i-run" aria-hidden="true"></span>2 live</span>');
	});

	it("shows no live badge for a quiet project", () => {
		const html = render();
		expect(html).not.toContain("av-badge run");
		expect(html).not.toContain("waiting");
	});

	it("disables Open project when the project has no session to open", () => {
		const html = render({ project: makeProject({ openHref: null }) });
		expect(html).toContain('<button type="button" class="av-btn p-open" disabled="">');
	});

	it("is draggable with a grip only in custom order", () => {
		const fixed = render();
		expect(fixed).toContain('draggable="false"');
		expect(fixed).not.toContain("p-grip");
		const custom = render({ drag: { onDragStart: () => undefined, onDrop: () => undefined } });
		expect(custom).toContain('class="av-proj home draggable"');
		expect(custom).toContain('draggable="true"');
		expect(custom).toContain('<span class="p-grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span>');
	});

	it("no longer lists the project's sessions or offers Archive on Home", () => {
		const html = render({ open: true });
		expect(html).not.toContain("av-srow");
		expect(html).not.toContain("Archive");
		expect(html).not.toContain("av-confirm");
	});
});
