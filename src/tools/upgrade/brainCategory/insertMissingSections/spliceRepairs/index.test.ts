import { describe, it, expect } from "vitest";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { planBrainRepair } from "@/service/install/provisionBrain/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker, BrainSectionRepair } from "@/types/index.js";
import toLineEnding from "../../shared/toLineEnding/index.js";
import spliceRepairs from "./index.js";

/** The marker-wrapped section (open marker through close marker) as it appears in `text`. */
function wrappedSection(text: string, marker: BrainSectionMarker): string {
	const { open, close } = toMarkerPair(marker);
	return text.slice(text.indexOf(open), text.indexOf(close) + close.length);
}

/** The template with the named sections (wrapped block plus the blank lines after it) removed. */
function templateWithout(markers: BrainSectionMarker[]): string {
	return markers.reduce((content, marker) => {
		const block = wrappedSection(content, marker);
		const start = content.indexOf(block);
		return content.slice(0, start) + content.slice(start + block.length).replace(/^\n+/, "");
	}, obsidianBrainAideTemplate());
}

function repairsFor(text: string): BrainSectionRepair[] {
	const repairs = planBrainRepair(parseBrainAideFromString(text));
	if (!repairs) throw new Error("fixture must parse as missing-sections");
	return repairs;
}

describe("spliceRepairs", () => {
	it("chains adjacent repairs on the close marker of the block inserted one step earlier", () => {
		const raw = templateWithout(["kanban-create", "kanban-work"]);
		const repairs = repairsFor(raw);
		expect(repairs.map(({ marker }) => marker)).toEqual(["kanban-create", "kanban-work"]);
		expect(repairs[1]!.insertAfter).toBe(toMarkerPair("kanban-create").close);

		const result = spliceRepairs({ raw, repairs, eol: "\n" });

		const { close } = toMarkerPair("kanban-create");
		expect(result).toContain(`${close}\n\n${repairs[1]!.block}`);
		expect(parseBrainAideFromString(result).kind).toBe("ok");
		expect(result).toBe(obsidianBrainAideTemplate());
	});

	it("places a null-anchored repair right after the frontmatter with one blank line on each side", () => {
		const raw = templateWithout(["orientation"]);
		const repairs = repairsFor(raw);
		expect(repairs).toHaveLength(1);
		expect(repairs[0]!.insertAfter).toBeNull();

		const result = spliceRepairs({ raw, repairs, eol: "\n" });

		expect(result).toBe(obsidianBrainAideTemplate());
	});

	it("adds an extra leading line break when the closing fence is the last line", () => {
		const raw = obsidianBrainAideTemplate().split("\n---\n")[0]! + "\n---";
		const repairs = repairsFor(raw);
		const result = spliceRepairs({ raw, repairs, eol: "\n" });

		expect(result.startsWith(raw + "\n\n")).toBe(true);
		expect(parseBrainAideFromString(result).kind).toBe("ok");
	});

	it("converts blocks and separators to CRLF without leaving a bare LF", () => {
		const raw = toLineEnding({ text: templateWithout(["kanban-review", "orientation"]), eol: "\r\n" });
		const repairs = repairsFor(raw);

		const result = spliceRepairs({ raw, repairs, eol: "\r\n" });

		expect(result.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		expect(result.trimEnd()).toBe(toLineEnding({ text: obsidianBrainAideTemplate(), eol: "\r\n" }).trimEnd());
	});

	it("returns the text unchanged for an empty repair list", () => {
		const raw = obsidianBrainAideTemplate();
		expect(spliceRepairs({ raw, repairs: [], eol: "\n" })).toBe(raw);
	});

	it("throws when an anchor marker is absent from the text", () => {
		const raw = obsidianBrainAideTemplate();
		const repair: BrainSectionRepair = {
			...repairsFor(templateWithout(["kanban-review"]))[0]!,
			insertAfter: "<!-- not-a-marker -->",
		};
		expect(() => spliceRepairs({ raw, repairs: [repair], eol: "\n" })).toThrow(/anchor/);
	});
});
