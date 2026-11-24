import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawerContext, DrawerItem } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import Drawer from "./index.js";

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
