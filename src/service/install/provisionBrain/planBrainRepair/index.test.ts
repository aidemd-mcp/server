import { describe, it, expect } from "vitest";
import planBrainRepair from "./index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker, BrainSectionRepair } from "@/types/index.js";

/** Plan the repair for a user file given as text, the way aide_upgrade does: parse once, plan from the parse. */
function planFor(text: string): BrainSectionRepair[] | undefined {
	return planBrainRepair(parseBrainAideFromString(text));
}

/** The marker-wrapped section (open marker through close marker) as it appears in `text`. */
function wrappedSection(text: string, marker: BrainSectionMarker): string {
	const { open, close } = toMarkerPair(marker);
	return text.slice(text.indexOf(open), text.indexOf(close) + close.length);
}

/** The template with the named sections (marker-wrapped block plus the blank line after it) removed. */
function templateWithout(markers: BrainSectionMarker[]): string {
	let content = obsidianBrainAideTemplate();
	for (const marker of markers) {
		const block = wrappedSection(content, marker);
		const start = content.indexOf(block);
		const before = content.slice(0, start);
		const after = content.slice(start + block.length).replace(/^\n+/, "");
		content = before + after;
	}
	return content;
}

/** Apply a prescription per provisionBrain brief commitment #6. */
function applyRepair(content: string, repairs: BrainSectionRepair[]): string {
	let result = content;
	for (const repair of repairs) {
		if (repair.insertAfter === null) {
			const fenceClose = result.indexOf("\n---\n", result.indexOf("---") + 3);
			const lineEnd = fenceClose + "\n---\n".length;
			result = result.slice(0, lineEnd) + repair.block + "\n\n" + result.slice(lineEnd);
		} else {
			const at = result.indexOf(repair.insertAfter) + repair.insertAfter.length;
			result = result.slice(0, at) + "\n\n" + repair.block + result.slice(at);
		}
	}
	return result;
}

describe("planBrainRepair", () => {
	it("missing two adjacent sections yields two entries anchored in order", () => {
		const repairs = planFor(templateWithout(["kanban-index", "kanban-create"]));

		expect(repairs?.map((r) => r.marker)).toEqual(["kanban-index", "kanban-create"]);
		expect(repairs?.[0].insertAfter).toBe(toMarkerPair("research-index").close);
		expect(repairs?.[1].insertAfter).toBe(toMarkerPair("kanban-index").close);
	});

	it("missing the first section anchors on null", () => {
		const repairs = planFor(templateWithout(["orientation"]));

		expect(repairs).toHaveLength(1);
		expect(repairs?.[0].marker).toBe("orientation");
		expect(repairs?.[0].insertAfter).toBeNull();
	});

	it("each block is byte-identical to the template's marker-wrapped section", () => {
		const template = obsidianBrainAideTemplate();

		const repairs = planFor(templateWithout(["config", "study-playbook", "kanban-index"]));

		expect(repairs).toHaveLength(3);
		for (const repair of repairs!) {
			expect(repair.block).toBe(wrappedSection(template, repair.marker as BrainSectionMarker));
		}
	});

	it("entries carry every contract field, in contract order", () => {
		const repairs = planFor(templateWithout(["playbook-index", "kanban-create"]));

		const expected = brainContract.filter(
			(e) => e.marker === "playbook-index" || e.marker === "kanban-create",
		);
		expect(repairs?.map((r) => r.marker)).toEqual(expected.map((e) => e.marker));
		for (const [i, entry] of expected.entries()) {
			expect(repairs?.[i]).toMatchObject(entry);
		}
	});

	it("a complete file yields undefined", () => {
		expect(planFor(obsidianBrainAideTemplate())).toBeUndefined();
	});

	it("a malformed file (half-present marker pair) yields undefined", () => {
		expect(
			planFor(
				"---\nname: x\nmcpServerConfig:\n  command: npx\n  args:\n    - a\n---\n\n<!-- aide-orientation-start -->\n\nhalf-present pair, never closed\n",
			),
		).toBeUndefined();
	});

	it("a missing parse yields undefined", () => {
		expect(planBrainRepair({ kind: "missing" })).toBeUndefined();
	});

	it("never changes the user's file bytes or the parse it was given, including customized sections", () => {
		const orientationOpen = toMarkerPair("orientation").open;
		const customized = templateWithout(["kanban-index"]).replace(
			orientationOpen,
			`${orientationOpen}\n\nCUSTOMIZED BY USER`,
		);
		const userText = customized;
		const parse = parseBrainAideFromString(userText);
		const parseBefore = structuredClone(parse);

		planBrainRepair(parse);

		expect(parse).toEqual(parseBefore);
		expect(userText).toBe(customized);
	});

	it("applying the prescription yields an ok file and leaves every present section byte-identical", () => {
		const missing: BrainSectionMarker[] = ["orientation", "playbook-index", "kanban-index"];
		const original = templateWithout(missing);
		expect(parseBrainAideFromString(original).kind).toBe("missing-sections");

		const repairs = planFor(original);
		const repaired = applyRepair(original, repairs!);

		const repairedParse = parseBrainAideFromString(repaired);
		expect(repairedParse.kind).toBe("ok");
		if (repairedParse.kind !== "ok") return;

		for (const entry of brainContract) {
			if (!missing.includes(entry.marker)) {
				expect(wrappedSection(repaired, entry.marker)).toBe(wrappedSection(original, entry.marker));
			}
		}

		// Inserted sections carry the template's bytes.
		const templateParse = parseBrainAideFromString(obsidianBrainAideTemplate());
		if (templateParse.kind !== "ok") throw new Error("template must parse ok");
		for (const entry of brainContract) {
			expect(repairedParse[entry.field]).toBe(templateParse[entry.field]);
		}
	});
});
