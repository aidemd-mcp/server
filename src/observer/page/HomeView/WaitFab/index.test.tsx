import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import type { WaitCardModel } from "@/observer/page/types/index.js";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: vi.fn(actual.useState) };
});

import { useState } from "react";
import WaitFab from "./index.js";

const CARDS: WaitCardModel[] = [
	{ key: "a", project: "alpha", file: "src/a/plan.aide", module: "src/a", since: "6m", at: "14:02", href: "/p/alpha-111111/s/s1?token=t" },
	{ key: "b", project: "beta", file: "src/b/todo.aide", module: "src/b", since: "1h", at: "13:00", href: "/p/beta-222222/s/s2?token=t" },
];

afterEach(() => {
	vi.mocked(useState).mockReset();
});

describe("WaitFab", () => {
	it("draws nothing while no gate is open", () => {
		expect(renderToStaticMarkup(<WaitFab cards={[]} onOpen={() => undefined} />)).toBe("");
	});

	it("draws one floating button with the waiting count, its list closed", () => {
		const html = renderToStaticMarkup(<WaitFab cards={CARDS} onOpen={() => undefined} />);
		expect(html).toContain('<div class="av-fab">');
		expect(html).toContain('<button type="button" class="av-fab-btn" aria-expanded="false">');
		expect(stripMarkup(html)).toContain("2 waiting");
		expect(html).not.toContain("av-fab-list");
	});

	it("lists each waiting gate with its project, file, module and how long when open", () => {
		vi.mocked(useState).mockImplementationOnce(() => [true, () => undefined] as never);
		const html = renderToStaticMarkup(<WaitFab cards={CARDS} onOpen={() => undefined} />);
		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain('<div class="av-fab-list" role="dialog" aria-label="Waiting on you">');
		expect(html.match(/class="fl-item"/g)).toHaveLength(2);
		expect(stripMarkup(html)).toContain("alphaapprove src/a/plan.aide for src/a6m");
		expect(stripMarkup(html)).toContain("betaapprove src/b/todo.aide for src/b1h");
	});
});
