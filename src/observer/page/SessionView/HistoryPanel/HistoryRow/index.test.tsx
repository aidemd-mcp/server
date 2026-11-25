import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryKind, HistoryRowModel } from "@/observer/page/types/index.js";
import KIND_FACTS from "@/observer/page/SessionView/buildHistoryModel/kindFacts/index.js";
import HistoryRow from "./index.js";

function row(fields: Partial<HistoryRowModel> & { kind: HistoryKind }): HistoryRowModel {
	return {
		id: "s1:1",
		sessionId: "s1",
		time: "14:03",
		day: "Today",
		...KIND_FACTS[fields.kind],
		label: "Spec started",
		mono: null,
		meta: null,
		sessionTag: null,
		item: { kind: "event", sessionId: "s1", seq: 1 },
		files: [],
		...fields,
	};
}

describe("HistoryRow", () => {
	it("draws the handoff's markup: time, glyph with its screen-reader word, label, mono part and meta", () => {
		const html = renderToStaticMarkup(
			<HistoryRow row={row({ kind: "wait", time: "14:18", label: "Waiting on you — approve", mono: "plan.aide", meta: "src/tools/score" })} showSession={false} onOpen={() => undefined} />,
		);
		expect(html).toBe(
			'<button type="button" class="av-hrow k-wait"><span class="h-t">14:18</span><span class="h-g"><span class="ic i-wait" aria-hidden="true"></span><span class="sr">waiting on you: </span></span><span class="h-l">Waiting on you — approve <span class="mono">plan.aide</span><span class="h-m">src/tools/score</span></span></button>',
		);
	});

	it("prints the session tag between the mono part and the meta only while two sessions share the history", () => {
		const tagged = row({ kind: "phase", sessionTag: "14:02", meta: "aide-spec-writer · src/tools/score" });
		expect(renderToStaticMarkup(<HistoryRow row={tagged} showSession onOpen={() => undefined} />)).toContain(
			'Spec started<span class="av-hsess">14:02</span><span class="h-m">aide-spec-writer · src/tools/score</span>',
		);
		expect(renderToStaticMarkup(<HistoryRow row={tagged} showSession={false} onOpen={() => undefined} />)).not.toContain("av-hsess");
	});

	it.each([
		["start", "k-start"],
		["prompt", "k-prompt"],
		["task", "k-task"],
		["phase", "k-phase"],
		["pipeline", "k-phase"],
		["skip", "k-phase"],
		["done", "k-done"],
		["approve", "k-approve"],
		["step", "k-step"],
		["issues", "k-issues"],
		["pass", "k-pass"],
		["commit", "k-commit"],
		["release", "k-release"],
		["error", "k-error"],
		["files", "k-files"],
	] as const)("classes a %s row `av-hrow %s` and gives it its own glyph", (kind, className) => {
		const html = renderToStaticMarkup(<HistoryRow row={row({ kind })} showSession={false} onOpen={() => undefined} />);
		expect(html).toContain(`class="av-hrow ${className}"`);
		expect(html).toContain(`class="ic i-${KIND_FACTS[kind].icon}"`);
	});

	it("draws a sub row as `av-hrow sub` with no time and the file glyph", () => {
		const html = renderToStaticMarkup(
			<HistoryRow row={row({ kind: "sub", time: "", label: "src/tools/score/weights.ts", kindWord: "created: " })} showSession={false} onOpen={() => undefined} />,
		);
		expect(html).toContain('class="av-hrow sub"');
		expect(html).toContain('<span class="h-t"></span>');
		expect(html).toContain('<span class="ic i-file" aria-hidden="true"></span><span class="sr">created: </span>');
	});

	it("draws a row with nothing to open as a plain block, not a button", () => {
		const html = renderToStaticMarkup(<HistoryRow row={row({ kind: "files", item: null, label: "Wrote 2 files" })} showSession={false} onOpen={() => undefined} />);
		expect(html.startsWith('<div class="av-hrow k-files">')).toBe(true);
		expect(html).not.toContain("<button");
	});
});
