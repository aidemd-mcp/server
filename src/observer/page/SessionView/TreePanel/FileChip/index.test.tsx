import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import findElements from "@/observer/page/__fixtures__/findElements/index.js";
import type { FileChipModel } from "@/observer/page/types/index.js";
import stripMarkup from "@/observer/page/__fixtures__/stripMarkup/index.js";
import FileChip from "./index.js";

function makeChip(chip: Partial<FileChipModel>): FileChipModel {
	return { kind: "brief", tone: "", icon: "doc", key: "brief.aide", value: null, file: "src/a/brief.aide", ...chip };
}

function render(chip: Partial<FileChipModel>): string {
	return renderToStaticMarkup(<FileChip chip={makeChip(chip)} onOpen={() => undefined} />);
}

describe("FileChip", () => {
	it("draws a plain chip as a button: the glyph and its file name, with no tone class and no value", () => {
		expect(render({})).toBe(
			'<button type="button" class="av-chip av-chip-btn" title="Open src/a/brief.aide"><span class="ic i-doc" aria-hidden="true"></span>brief.aide</button>',
		);
	});

	it("draws a toned chip with its tone class and the value in bold after a space", () => {
		const html = render({ kind: "plan", tone: "run", icon: "run", key: "plan.aide · approved", value: "3/9", file: "src/a/plan.aide" });
		expect(html).toBe(
			'<button type="button" class="av-chip av-chip-btn run" title="Open src/a/plan.aide"><span class="ic i-run" aria-hidden="true"></span>plan.aide · approved <b>3/9</b></button>',
		);
		expect(stripMarkup(html)).toBe("plan.aide · approved 3/9");
	});

	it.each(["warn", "run", "done", "muted", "danger"] as const)("carries the %s tone as a class", (tone) => {
		expect(render({ tone })).toContain(`class="av-chip av-chip-btn ${tone}"`);
	});

	it("opens its file when pressed", () => {
		const onOpen = vi.fn();
		const [button] = findElements({ node: FileChip({ chip: makeChip({}), onOpen }), match: (element) => element.type === "button" });
		expect(button).toBeDefined();
		(button!.props.onClick as () => void)();
		expect(onOpen).toHaveBeenCalledTimes(1);
	});
});
