import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import planBrainRepair from "./index.js";
import obsidianBrainAideTemplate from "../../obsidianBrainAideTemplate/index.js";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker, BrainSectionRepair } from "@/types/index.js";

let projectRoot: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-plan-brain-repair-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

const brainAidePath = () => join(projectRoot, ".aide", "config", "brain.aide");

async function writeBrainAide(content: string): Promise<void> {
	await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
	await writeFile(brainAidePath(), content, "utf-8");
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
	it("missing the last two sections yields two entries anchored in order", async () => {
		await writeBrainAide(templateWithout(["kanban-board", "kanban-index"]));

		const repairs = await planBrainRepair(projectRoot);

		expect(repairs?.map((r) => r.marker)).toEqual(["kanban-board", "kanban-index"]);
		expect(repairs?.[0].insertAfter).toBe(toMarkerPair("research-index").close);
		expect(repairs?.[1].insertAfter).toBe(toMarkerPair("kanban-board").close);
	});

	it("missing the first section anchors on null", async () => {
		await writeBrainAide(templateWithout(["orientation"]));

		const repairs = await planBrainRepair(projectRoot);

		expect(repairs).toHaveLength(1);
		expect(repairs?.[0].marker).toBe("orientation");
		expect(repairs?.[0].insertAfter).toBeNull();
	});

	it("each block is byte-identical to the template's marker-wrapped section", async () => {
		await writeBrainAide(templateWithout(["config", "study-playbook", "kanban-index"]));
		const template = obsidianBrainAideTemplate();

		const repairs = await planBrainRepair(projectRoot);

		expect(repairs).toHaveLength(3);
		for (const repair of repairs!) {
			expect(repair.block).toBe(wrappedSection(template, repair.marker as BrainSectionMarker));
		}
	});

	it("entries carry every contract field, in contract order", async () => {
		await writeBrainAide(templateWithout(["playbook-index", "kanban-board"]));

		const repairs = await planBrainRepair(projectRoot);

		const expected = brainContract.filter(
			(e) => e.marker === "playbook-index" || e.marker === "kanban-board",
		);
		expect(repairs?.map((r) => r.marker)).toEqual(expected.map((e) => e.marker));
		for (const [i, entry] of expected.entries()) {
			expect(repairs?.[i]).toMatchObject(entry);
		}
	});

	it("a complete file yields undefined", async () => {
		await writeBrainAide(obsidianBrainAideTemplate());
		expect(await planBrainRepair(projectRoot)).toBeUndefined();
	});

	it("a malformed file (half-present marker pair) yields undefined", async () => {
		await writeBrainAide(
			"---\nname: x\nmcpServerConfig:\n  command: npx\n  args:\n    - a\n---\n\n<!-- aide-orientation-start -->\n\nhalf-present pair, never closed\n",
		);
		expect(await planBrainRepair(projectRoot)).toBeUndefined();
	});

	it("an absent file yields undefined", async () => {
		expect(await planBrainRepair(projectRoot)).toBeUndefined();
	});

	it("never changes the user's file bytes, including customized sections", async () => {
		const orientationOpen = toMarkerPair("orientation").open;
		const customized = templateWithout(["kanban-index"]).replace(
			orientationOpen,
			`${orientationOpen}\n\nCUSTOMIZED BY USER`,
		);
		await writeBrainAide(customized);

		await planBrainRepair(projectRoot);

		expect(await readFile(brainAidePath(), "utf-8")).toBe(customized);
	});

	it("applying the prescription yields an ok file and leaves every present section byte-identical", async () => {
		const missing: BrainSectionMarker[] = ["orientation", "playbook-index", "kanban-index"];
		const original = templateWithout(missing);
		expect(parseBrainAideFromString(original).kind).toBe("missing-sections");
		await writeBrainAide(original);

		const repairs = await planBrainRepair(projectRoot);
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
