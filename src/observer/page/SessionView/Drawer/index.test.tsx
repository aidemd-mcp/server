import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawerContext, DrawerItem, DrawerModel, Fetched } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import Drawer from "./index.js";

/** What the model hook returns while a test pins it; null leaves the real hook running. */
const pinned = vi.hoisted(() => ({ model: null as unknown }));
vi.mock("./useDrawerModel/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./useDrawerModel/index.js")>();
	return { default: (args: Parameters<typeof actual.default>[0]) => (pinned.model === null ? actual.default(args) : pinned.model) };
});

afterEach(() => {
	pinned.model = null;
});

const EVENTS = [
	makeEvent({ seq: 1, ts: "2026-11-23T14:02:00.000Z", kind: "prompt", text: "Pick up the next p1.\n\nKeep commits small." }),
	makeEvent({ seq: 2, ts: "2026-11-23T14:29:00.000Z", kind: "commit", sha: "414776f0a1b2", message: "score: add weights" }),
];

const html = (item: DrawerItem, context: DrawerContext = makeContext({ events: EVENTS })) => renderToStaticMarkup(<Drawer item={item} context={context} onClose={() => undefined} />);

describe("Drawer", () => {
	it("is a non-modal dialog labelled by its visible title", () => {
		const markup = html({ kind: "event", sessionId: "s1", seq: 1 });
		const labelledBy = /<aside class="av-drawer" role="dialog" aria-modal="false" aria-labelledby="([^"]+)">/.exec(markup);
		expect(labelledBy).not.toBeNull();
		expect(markup).toContain(`<span id="${labelledBy![1]}" class="d-t">Pick up the next p1.</span>`);
	});

	it("heads with the kind word, title and meta, then the blocks", () => {
		const markup = html({ kind: "event", sessionId: "s1", seq: 1 });
		expect(markup).toMatch(/<div class="av-drawer-h"><div class="grow stack" style="gap:2px"><span class="d-k">Prompt · \d\d:\d\d<\/span>/);
		expect(markup).toMatch(/<span class="meta">session \d\d:\d\d<\/span>/);
		expect(markup).toContain('<div class="av-drawer-b"><section><h4>');
		expect(markup).toContain('<div class="av-pre">Pick up the next p1.\n\nKeep commits small.</div>');
	});

	it("sets a mono title for a sha, a path or a slug", () => {
		expect(html({ kind: "event", sessionId: "s1", seq: 2 })).toContain('class="d-t mono">414776f</span>');
	});

	it("has one close button named Close details", () => {
		const markup = html({ kind: "event", sessionId: "s1", seq: 1 });
		expect(markup).toContain('<button type="button" class="av-btn icon ghost" aria-label="Close details"><span class="ic lg i-close" aria-hidden="true"></span></button>');
		expect(markup.match(/<button/g)).toHaveLength(1);
	});

	it("shows the header alone while a module's files load", () => {
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }) });
		const markup = html({ kind: "module", folder: "src/tools/score" }, context);
		expect(markup).toContain('<span class="d-k">Module</span>');
		expect(markup).toContain('class="d-t mono">src/tools/score</span>');
		expect(markup).toContain('<div class="av-drawer-b"></div>');
	});
});

const ready = (data: Partial<DrawerModel> & Pick<DrawerModel, "kind" | "title">): Fetched<DrawerModel> => ({
	state: "ready",
	data: { titleMono: false, meta: null, blocks: [], ...data },
});

const dockedHtml = (model: Fetched<DrawerModel>): string => {
	pinned.model = model;
	return renderToStaticMarkup(<Drawer item={{ kind: "task", slug: "x" }} context={makeContext()} docked onClose={() => undefined} />);
};

describe("Drawer, docked", () => {
	it("is the docked aside, with a compact header of the kind's glyph and word and no close button", () => {
		const markup = dockedHtml(ready({ kind: "Task", title: "T" }));
		expect(markup).toContain('<aside class="av-drawer docked" role="dialog" aria-modal="false"');
		expect(markup).toContain('<div class="av-drawer-h compact"><span class="d-kind"><span class="ic i-task" aria-hidden="true"></span>Task</span></div>');
		expect(markup).not.toContain("d-k\"");
		expect(markup).not.toContain("Close details");
	});

	it("draws the title block in the body with a caption saying what the title is, and labels the dialog by that title", () => {
		const markup = dockedHtml(ready({ kind: "Task", title: "Fix the rank" }));
		const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup);
		expect(labelledBy).not.toBeNull();
		expect(markup).toContain('<div class="av-drawer-b"><div class="d-titleblock"><span class="d-cap">Task title</span>');
		expect(markup).toContain(`<span id="${labelledBy![1]}" class="d-t">Fix the rank</span>`);
	});

	it.each([
		["Module", "Module path"],
		["Module · todo", "Module path"],
		["File", "File path"],
		["Task", "Task title"],
		["Prompt · 14:03", "Title"],
	])("captions a %s title %s", (kind, caption) => {
		expect(dockedHtml(ready({ kind, title: "t" }))).toContain(`<span class="d-cap">${caption}</span>`);
	});

	it("sets a mono title where the model says so", () => {
		expect(dockedHtml(ready({ kind: "Module", title: "src/a", titleMono: true }))).toContain('class="d-t mono">src/a</span>');
	});

	it("shows a module's alignment with its status glyph in place of the meta line", () => {
		const markup = dockedHtml(ready({ kind: "Module", title: "src/a", meta: "aligned · plan approved 3/9", alignment: "misaligned" }));
		expect(markup).toContain('<span class="d-align misaligned"><span class="ic i-fail" aria-hidden="true"></span>misaligned</span>');
		expect(markup).not.toContain("d-meta");
	});

	it("shows the meta line when the model has no alignment", () => {
		expect(dockedHtml(ready({ kind: "Task", title: "T", meta: "fix-it" }))).toContain('<span class="d-meta mono">fix-it</span>');
		expect(dockedHtml(ready({ kind: "Task", title: "T", meta: null }))).not.toContain("d-meta");
	});

	it("draws a task's column, priority and type as chips, each but the column only when it has one", () => {
		const full = dockedHtml(ready({ kind: "Task", title: "T", taskChips: { column: "In Progress", priority: "p1", type: "bug" } }));
		expect(full).toContain(
			'<span class="pm-task-chips"><span class="av-badge neutral">In Progress</span><span class="av-badge av-prio p1">p1</span><span class="av-badge outline">bug</span></span>',
		);
		const bare = dockedHtml(ready({ kind: "Task", title: "T", taskChips: { column: "Done", priority: null, type: null } }));
		expect(bare).toContain('<span class="pm-task-chips"><span class="av-badge neutral">Done</span></span>');
		expect(dockedHtml(ready({ kind: "Task", title: "T" }))).not.toContain("pm-task-chips");
	});

	it("says a note has no details beyond its title once ready with nothing to show, and not while loading", () => {
		expect(dockedHtml(ready({ kind: "Task", title: "T" }))).toContain('<p class="t3 d-empty">This note has no details beyond its title.</p>');
		expect(dockedHtml({ state: "loading" })).not.toContain("d-empty");
	});

	it("draws a module's files as accordion rows, and no empty note while it has any", () => {
		const list = [{ kind: "spec" as const, label: ".aide", path: "src/a/.aide", status: "aligned", blocks: [{ heading: "Frontmatter", icon: "doc" as const, badge: null, type: "pre" as const, text: "BODY" }] }];
		const markup = dockedHtml(ready({ kind: "Module", title: "src/a", sections: { open: "spec", list } }));
		expect(markup).toContain('<div class="av-files">');
		expect(markup).toContain("BODY");
		expect(markup).not.toContain("d-empty");
	});

	it("says there are no details for a module whose sections list is empty", () => {
		expect(dockedHtml(ready({ kind: "Module", title: "src/none", sections: { open: "spec", list: [] } }))).toContain("d-empty");
	});

	it("draws the plain blocks of a drawer that has no sections", () => {
		const markup = dockedHtml(ready({ kind: "File", title: "a.ts", blocks: [{ heading: "Text", icon: "file", badge: null, type: "pre", text: "export {};" }] }));
		expect(markup).toContain("export {};");
		expect(markup).not.toContain("av-files");
	});
});

describe("Drawer, overlay", () => {
	it("keeps the title in the header and says the empty note there too", () => {
		pinned.model = ready({ kind: "Task", title: "T", meta: "fix-it" });
		const markup = renderToStaticMarkup(<Drawer item={{ kind: "task", slug: "x" }} context={makeContext()} onClose={() => undefined} />);
		expect(markup).toContain('<span class="d-k">Task</span>');
		expect(markup).not.toContain("d-titleblock");
		expect(markup).toContain("d-empty");
	});
});
