import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FileChipModel } from "@/observer/page/types/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import FileChip from "./index.js";

function render(chip: Partial<FileChipModel>): string {
	return renderToStaticMarkup(<FileChip chip={{ kind: "brief", tone: "", icon: "doc", key: "brief", value: null, file: "brief.aide", ...chip }} />);
}

describe("FileChip", () => {
	it("draws a plain chip as the glyph and its key, with no tone class and no value", () => {
		expect(render({})).toBe('<span class="av-chip"><span class="ic i-doc" aria-hidden="true"></span>brief</span>');
	});

	it("draws a toned chip with its tone class and the value in bold after a space", () => {
		const html = render({ kind: "plan", tone: "run", icon: "run", key: "plan · approved", value: "3/9" });
		expect(html).toBe('<span class="av-chip run"><span class="ic i-run" aria-hidden="true"></span>plan · approved <b>3/9</b></span>');
		expect(stripMarkup(html)).toBe("plan · approved 3/9");
	});

	it.each(["warn", "run", "done", "muted", "danger"] as const)("carries the %s tone as a class", (tone) => {
		expect(render({ tone })).toContain(`class="av-chip ${tone}"`);
	});
});
