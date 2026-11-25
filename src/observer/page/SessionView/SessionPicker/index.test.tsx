import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: vi.fn(actual.useState) };
});

import { useState } from "react";
import SessionPicker from "./index.js";

const NOW = new Date(2026, 10, 23, 16, 0, 0);

function makeRow(sessionId: string, overrides: Partial<SessionRowModel> = {}): SessionRowModel {
	return {
		sessionId,
		startedAt: new Date(2026, 10, 23, 15, 45, 0).toISOString(),
		lastEventAt: null,
		eventCount: 2,
		liveness: makeLiveness({ now: NOW }),
		task: null,
		label: null,
		...overrides,
	};
}

const rows = [makeRow("a"), makeRow("b", { startedAt: new Date(2026, 10, 22, 9, 5, 0).toISOString(), liveness: makeLiveness({ state: "ended", now: NOW }) })];

/** Calls the picker as a function with its open state forced, since a static render cannot click. */
function renderOpen({ open, current = "a", onPick }: { open: boolean; current?: string; onPick(sessionId: string): void }) {
	const setOpen = vi.fn();
	vi.mocked(useState).mockReturnValueOnce([open, setOpen] as never);
	return { tree: SessionPicker({ sessions: rows, current, now: NOW, onPick }), setOpen };
}

describe("SessionPicker", () => {
	beforeEach(() => {
		vi.mocked(useState).mockClear();
	});

	it("is a closed chip naming the followed session's start and liveness", () => {
		const html = renderToStaticMarkup(<SessionPicker sessions={rows} current="a" now={NOW} onPick={() => undefined} />);
		expect(html).toContain('<button type="button" class="av-picker-btn" aria-expanded="false" aria-haspopup="listbox">');
		expect(stripMarkup(html)).toBe("Session 15:45Working");
		expect(html).toContain('<span class="p-live run">Working</span>');
		expect(html).not.toContain("av-picker-list");
	});

	it("names no start and no liveness when the followed session is not listed", () => {
		const html = renderToStaticMarkup(<SessionPicker sessions={rows} current="gone" now={NOW} onPick={() => undefined} />);
		expect(stripMarkup(html)).toBe("Session ");
		expect(html).not.toContain("p-live");
	});

	it("lists every session when open, each with its day, start and liveness, the followed one selected", () => {
		const { tree } = renderOpen({ open: true, onPick: () => undefined });
		const options = findElements({ node: tree, match: (element) => element.type === "li" });
		expect(options.map((option) => option.props["aria-selected"])).toEqual([true, false]);
		const html = renderToStaticMarkup(<>{tree}</>);
		expect(html).toContain('<ul class="av-picker-list" role="listbox" aria-label="Sessions in this project">');
		expect(stripMarkup(html)).toContain("Today 15:45WorkingYesterday 09:05Ended");
	});

	it("words a waiting and a quiet session by their liveness, the minutes counted from the page clock", () => {
		const mixed = [
			makeRow("w", { liveness: makeLiveness({ state: "waiting", now: NOW }) }),
			makeRow("q", { liveness: makeLiveness({ minutesQuiet: 20, now: NOW }) }),
		];
		const html = renderToStaticMarkup(<SessionPicker sessions={mixed} current="w" now={NOW} onPick={() => undefined} />);
		expect(html).toContain('<span class="p-live wait">Waiting on you</span>');
		const later = new Date(NOW.getTime() + 5 * 60 * 1000);
		const setOpen = vi.fn();
		vi.mocked(useState).mockReturnValueOnce([true, setOpen] as never);
		const open = SessionPicker({ sessions: mixed, current: "q", now: later, onPick: () => undefined });
		expect(stripMarkup(renderToStaticMarkup(<>{open}</>))).toContain("Quiet 25 min · maybe stuck");
	});

	it("picks a session through onPick and closes the list, with no navigation", () => {
		const onPick = vi.fn();
		const { tree, setOpen } = renderOpen({ open: true, onPick });
		const buttons = findElements({ node: tree, match: (element) => element.type === "button" && typeof element.props.onClick === "function" });
		(buttons[2]!.props.onClick as () => void)();
		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onPick).toHaveBeenCalledWith("b");
		expect(setOpen).toHaveBeenCalledWith(false);
		expect(findElements({ node: tree, match: (element) => element.type === "a" })).toEqual([]);
		expect(renderToStaticMarkup(<>{tree}</>)).not.toContain("href");
	});

	it("opens and closes the list from the chip", () => {
		const closed = renderOpen({ open: false, onPick: () => undefined });
		(findElements({ node: closed.tree, match: (element) => element.type === "button" })[0]!.props.onClick as () => void)();
		expect(closed.setOpen).toHaveBeenCalledWith(true);
		const open = renderOpen({ open: true, onPick: () => undefined });
		(findElements({ node: open.tree, match: (element) => element.type === "button" })[0]!.props.onClick as () => void)();
		expect(open.setOpen).toHaveBeenCalledWith(false);
	});
});
