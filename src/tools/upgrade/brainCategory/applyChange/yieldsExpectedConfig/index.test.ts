import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import parseBundledTemplate from "@/service/install/provisionBrain/parseBundledTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainChangeOffer, BrainChangeTarget, BrainSectionMarker } from "@/types/index.js";
import locateFrontmatter from "../../shared/locateFrontmatter/index.js";
import toLineEnding from "../../shared/toLineEnding/index.js";
import buildChangeOffer from "../../shared/buildChangeOffer/index.js";
import yieldsExpectedConfig from "./index.js";

type Offer = Extract<BrainChangeOffer, { kind: "offer" }>;

const v090 = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	),
	"utf8",
);
const template = parseBundledTemplate();

/** Builds the real offer for `target` on `raw`, failing the test when none is offered. */
function offerFor(raw: string, target: BrainChangeTarget): Offer {
	const offer = buildChangeOffer({ raw, parse: parseBrainAideFromString(raw), target });
	if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);
	return offer;
}

/** `raw` with the bytes between `marker`'s pair replaced by `body`. */
function withSectionBody(raw: string, marker: BrainSectionMarker, body: string): string {
	const { open, close } = toMarkerPair(marker);
	const start = raw.indexOf(open) + open.length;
	return raw.slice(0, start) + body + raw.slice(raw.indexOf(close));
}

describe("yieldsExpectedConfig", () => {
	describe("missing-sections file (the v0.9.0 fixture)", () => {
		const parse = parseBrainAideFromString(v090);

		it("accepts a real section offer: the spliced section bytes equal after", () => {
			expect(parse.kind).toBe("missing-sections");
			const offer = offerFor(v090, "orientation");

			expect(yieldsExpectedConfig({ parse, offer })).toBe(true);
		});

		it("fails a section offer whose spliced text does not carry offer.after", () => {
			const offer = offerFor(v090, "orientation");

			expect(yieldsExpectedConfig({ parse, offer: { ...offer, after: `${template.orientation}extra` } })).toBe(false);
		});

		it("accepts a real launcher offer: mcpServerConfig deep-equals the legacy launcher's after.local", () => {
			const offer = offerFor(v090, "launcher");

			expect(yieldsExpectedConfig({ parse, offer })).toBe(true);
		});

		it("fails a launcher offer whose text leaves the legacy launcher unchanged", () => {
			const offer = offerFor(v090, "launcher");

			expect(yieldsExpectedConfig({ parse, offer: { ...offer, text: v090 } })).toBe(false);
		});

		it("fails a launcher offer when the file has no legacy launcher to compare against", () => {
			const migrated = offerFor(v090, "launcher").text;
			const migratedParse = parseBrainAideFromString(migrated);
			const offer: Offer = { kind: "offer", target: "launcher", before: "", after: "", text: migrated };

			expect(yieldsExpectedConfig({ parse: migratedParse, offer })).toBe(false);
		});

		it("fails when the spliced text parses to a different kind than the original", () => {
			const offer = offerFor(v090, "orientation");

			expect(yieldsExpectedConfig({ parse, offer: { ...offer, text: obsidianBrainAideTemplate() } })).toBe(false);
		});

		it("fails when the spliced text no longer parses to a usable config", () => {
			const offer = offerFor(v090, "orientation");

			expect(yieldsExpectedConfig({ parse, offer: { ...offer, text: "not a brain config" } })).toBe(false);
		});
	});

	describe("ok file (the bundled template)", () => {
		const raw = obsidianBrainAideTemplate();
		const parse = parseBrainAideFromString(raw);

		it("accepts a section offer read from the ok parse's own field", () => {
			expect(parse.kind).toBe("ok");
			const text = withSectionBody(raw, "orientation", "\nreplacement orientation\n");
			const written = parseBrainAideFromString(text);
			if (written.kind !== "ok") throw new Error(`expected ok, got: ${written.kind}`);
			const offer: Offer = { kind: "offer", target: "orientation", before: template.orientation, after: written.orientation, text };

			expect(yieldsExpectedConfig({ parse, offer })).toBe(true);
		});

		it("fails when the written section bytes differ from offer.after", () => {
			const text = withSectionBody(raw, "orientation", "\nreplacement orientation\n");
			const offer: Offer = { kind: "offer", target: "orientation", before: template.orientation, after: template.orientation, text };

			expect(yieldsExpectedConfig({ parse, offer })).toBe(false);
		});
	});

	describe.each([
		["POSIX npx", "npx", "    - '-y'"],
		["cmd /c npx", "cmd", "    - '/c'\n    - 'npx'\n    - '-y'"],
	])("%s launcher", (_name, command, leading) => {
		it.each([
			["a null slot", "    -"],
			["a string path", "    - 'D:\\vault'"],
		])("accepts the real launcher offer with %s and fails a launcher text left unchanged", (_slotName, slotLine) => {
			const base = obsidianBrainAideTemplate();
			const { yamlStart, yamlEnd } = locateFrontmatter(base);
			const region = `name: obsidian\nmcpServerConfig:\n  command: ${command}\n  args:\n${leading}\n    - '@bitbonsai/mcpvault@0.9.0'\n${slotLine}\n`;
			const raw = toLineEnding({ text: base.slice(0, yamlStart) + region + base.slice(yamlEnd), eol: "\r\n" });
			const parse = parseBrainAideFromString(raw);
			const offer = offerFor(raw, "launcher");

			expect(yieldsExpectedConfig({ parse, offer })).toBe(true);
			expect(yieldsExpectedConfig({ parse, offer: { ...offer, text: raw } })).toBe(false);
		});
	});

	it("throws when the section target is not in the brain contract", () => {
		const parse = parseBrainAideFromString(v090);
		const offer: Offer = { ...offerFor(v090, "orientation"), target: "not-a-section" as BrainChangeTarget };

		expect(() => yieldsExpectedConfig({ parse, offer })).toThrow("applyChange target not-a-section is not in the brain contract");
	});
});
