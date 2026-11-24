import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TreeAlignment } from "@/observer/page/types/index.js";
import AlignmentBadge from "./index.js";

describe("AlignmentBadge", () => {
	it.each([
		["aligned", "av-badge done", "i-done", "Aligned"],
		["unreviewed", "av-badge outline", "i-todo", "Unreviewed"],
		["misaligned", "av-badge strong-danger", "i-fail", "Misaligned"],
	] as [TreeAlignment, string, string, string][])("%s is the %s badge with the %s glyph and the word %s", (alignment, className, glyph, word) => {
		expect(renderToStaticMarkup(<AlignmentBadge alignment={alignment} />)).toBe(
			`<span class="${className}"><span class="ic ${glyph}" aria-hidden="true"></span>${word}</span>`,
		);
	});
});
