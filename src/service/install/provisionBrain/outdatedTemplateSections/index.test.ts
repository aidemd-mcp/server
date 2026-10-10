import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import fingerprintSection from "../detectBrainMigration/findStaleSections/fingerprintSection/index.js";
import outdatedTemplateSections from "./index.js";

/** Brief #35: the current template's fingerprint for every contract marker. */
const CURRENT_FINGERPRINTS: Record<BrainSectionMarker, string> = {
	orientation: "4928cebf581bd94c5f49ddfbceae88eda1eec4fc323060e5da094af88c7b0ab7",
	config: "cee72c09b0a554c1431390311a434ecf8c3c94f6520d2f44f0efcaf039b714c5",
	"playbook-index": "078d3c940dac5d2f7766de53eab609c3873c67def757c7fec345418cffff6c75",
	"study-playbook": "884ac5fa4ab21bb9e6ab221eee6f0bf6f01d81da40d7e4c51315e62e2948c7d9",
	"update-playbook": "06d4b538fb870eec652fec875b62856b1cee6bab0056f635d9525a69f4ac60b3",
	"research-index": "6162c299a13af5fc55d9ec96a97f9051df3865e652f9085cdd1c5bf2d70da3c0",
	"kanban-index": "17dbab1c27043372a7c3f04b4a9fdf06542e41b61a44a80db1c4e3b63b0a37e7",
	"kanban-create": "158625ff36d4a3d92e00952aa9b10ffbc92f11be1bf00e81aa5d5de12406f6b2",
	"kanban-work": "71ae9f8ffed17fc9ab9e81ea8978dbf14d003c21ad8c114ea3596fd9d90bc9a7",
	"kanban-manage": "f74b371a13170e53f1cbddd6e1f66effc13054ca2f77894ea32adeb2a73fe2d1",
	"kanban-move": "e9aa047c93f20738e261442c6943193baae8f577ff2eec43321f3d06d4b28486",
	"kanban-complete": "de2be00bba725286a08dd6cc2810375bf643ef156a8bc2cf2e4302acae77e220",
	"kanban-stash": "59ad3428ca531123e3459859e7905b7481858bd9407a670c8fa6709fa56c5727",
	"kanban-review": "c531a55e6a768ac7e176045e6c012669811a5b0f6e117bd70daf47e315c7f978",
};

const parsed = parseBrainAideFromString(obsidianBrainAideTemplate());
if (parsed.kind !== "ok") {
	throw new Error(`Bundled template did not parse: ${parsed.kind}`);
}
const templateSections = parsed;

const markers = brainContract.map((entry) => entry.marker);
const recorded = Object.entries(outdatedTemplateSections) as [
	BrainSectionMarker,
	readonly { fingerprint: string; seenIn: string }[],
][];

describe("outdatedTemplateSections", () => {
	it("is keyed only by brainContract markers", () => {
		for (const [marker] of recorded) {
			expect(markers).toContain(marker);
		}
	});

	it("records 64-char lowercase hex fingerprints with a seenIn label, unique within a marker", () => {
		for (const [marker, versions] of recorded) {
			const fingerprints = versions.map((v) => v.fingerprint);
			for (const version of versions) {
				expect(version.fingerprint, marker).toMatch(/^[0-9a-f]{64}$/);
				expect(version.seenIn.length, marker).toBeGreaterThan(0);
			}
			expect(new Set(fingerprints).size, marker).toBe(fingerprints.length);
		}
	});

	it("never records the current template's own fingerprint", () => {
		for (const entry of brainContract) {
			const current = fingerprintSection(templateSections[entry.field]);
			const listed = (outdatedTemplateSections[entry.marker] ?? []).map((v) => v.fingerprint);
			expect(listed, entry.marker).not.toContain(current);
		}
	});

	it.each(markers)("pins the current template fingerprint of section %s", (marker) => {
		const entry = brainContract.find((e) => e.marker === marker)!;
		const actual = fingerprintSection(templateSections[entry.field]);
		expect(
			actual,
			`Template section "${marker}" changed: append its previous fingerprint to outdatedTemplateSections, then update this pin.`,
		).toBe(CURRENT_FINGERPRINTS[marker]);
	});
});
