import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { ParseBrainAideResult } from "@/types/index.js";
import obsidianBrainAideTemplate from "../../obsidianBrainAideTemplate/index.js";
import detectBrainMigration from "../../detectBrainMigration/index.js";
import summarizeBrainConfig from "./index.js";
import listBrainSections from "./listBrainSections/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "detectBrainMigration", "__fixtures__");
const v090 = readFileSync(join(fixturesDir, "v0.9.0-brain.txt"), "utf8");

const summarize = (text: string) => summarizeBrainConfig(parseBrainAideFromString(text));
const emptyFindings = { missingSections: [], staleSections: [], legacyLauncher: null, templateIntegration: null };

describe("summarizeBrainConfig", () => {
	it("a null parse (would-create) lists the sections with empty findings and null integration", () => {
		expect(summarizeBrainConfig(null)).toEqual({ sections: listBrainSections(), ...emptyFindings });
	});

	it("the current template has nothing missing or stale and is the template integration", () => {
		expect(summarize(obsidianBrainAideTemplate())).toEqual({
			sections: listBrainSections(),
			missingSections: [],
			staleSections: [],
			legacyLauncher: null,
			templateIntegration: true,
		});
	});

	it("the v0.9.0 fixture reports its missing markers, stale markers, launcher reasons and template integration", () => {
		const parse = parseBrainAideFromString(v090);
		if (parse.kind !== "missing-sections") throw new Error("the v0.9.0 fixture must parse as missing-sections");
		const migration = detectBrainMigration(parse)!;

		const summary = summarizeBrainConfig(parse);

		expect(summary.missingSections).toEqual(parse.sections);
		expect(summary.missingSections.length).toBeGreaterThan(0);
		expect(summary.staleSections).toEqual(migration.staleSections.map((offer) => offer.marker));
		expect(summary.staleSections).toEqual(["orientation", "config"]);
		expect(summary.legacyLauncher).toEqual(["unpinned", "missing-auto-confirm"]);
		expect(summary.templateIntegration).toBe(true);
		expect(summary.sections).toEqual(listBrainSections());
	});

	it("the v0.9.0 summary carries no section text and stays under 4096 bytes serialized", () => {
		const serialized = JSON.stringify(summarize(v090));
		const orientationLine = "Your brain is an Obsidian-backed knowledge store.";
		expect(obsidianBrainAideTemplate()).toContain(orientationLine);
		expect(v090).toContain(orientationLine);
		expect(serialized).not.toContain(orientationLine);
		expect(serialized).not.toContain("mcp__brain__read_note");
		expect(Buffer.byteLength(serialized, "utf8")).toBeLessThan(4096);
	});

	it("a missing-sections config on a non-template launcher reports templateIntegration false", () => {
		const otherLauncher = obsidianBrainAideTemplate().replace(
			/mcpServerConfig:[\s\S]*?\n---/,
			"mcpServerConfig:\n  command: node\n  args:\n    - 'custom-server.js'\n---",
		);
		const withoutLastSection = otherLauncher.slice(0, otherLauncher.indexOf("<!-- aide-kanban-review-start -->")).trimEnd() + "\n";
		const parse = parseBrainAideFromString(withoutLastSection);
		if (parse.kind !== "missing-sections") throw new Error("the trimmed config must parse as missing-sections");

		const summary = summarizeBrainConfig(parse);

		expect(summary.missingSections).toEqual(["kanban-review"]);
		expect(summary.templateIntegration).toBe(false);
	});

	it.each([
		["malformed frontmatter", parseBrainAideFromString("no frontmatter at all\n")],
		["malformed body", parseBrainAideFromString(obsidianBrainAideTemplate().replace("<!-- aide-orientation-end -->", ""))],
		["missing", { kind: "missing" }],
		["unreadable", { kind: "unreadable", reason: "EACCES" }],
	] satisfies [string, ParseBrainAideResult][])("a %s parse yields empty findings with null integration", (_label, parse) => {
		expect(summarizeBrainConfig(parse)).toEqual({ sections: listBrainSections(), ...emptyFindings });
	});
});
