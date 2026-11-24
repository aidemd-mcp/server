import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import SessionSwitcher from "./index.js";

const options = [
	{ id: "a", start: "14:02", now: "Plan · src/tools/score", pressed: true },
	{ id: "b", start: "15:30", now: "Research · src/tools/validate", pressed: false },
];

describe("SessionSwitcher", () => {
	const html = renderToStaticMarkup(<SessionSwitcher options={options} onPick={() => undefined} />);

	it("is a labelled group of toggle buttons with the followed session pressed", () => {
		expect(html).toContain('<div class="av-switch" role="group" aria-label="Live sessions in this project">');
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain('aria-pressed="false"');
	});

	it("shows each session's start and what it is doing now", () => {
		expect(stripMarkup(html)).toBe("Session 14:02Plan · src/tools/scoreSession 15:30Research · src/tools/validate");
	});
});
