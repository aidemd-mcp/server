import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import fingerprintSection from "../detectBrainMigration/findStaleSections/fingerprintSection/index.js";
import outdatedTemplateSections from "./index.js";

/** Brief #35: the current template's fingerprint for every contract marker. */
const CURRENT_FINGERPRINTS: Record<BrainSectionMarker, string> = {
	orientation: "b24d4092424cca080aee987b2ac9bff0891b828692360dea5bcfc2df91ff70a7",
	config: "cee72c09b0a554c1431390311a434ecf8c3c94f6520d2f44f0efcaf039b714c5",
	"playbook-index": "078d3c940dac5d2f7766de53eab609c3873c67def757c7fec345418cffff6c75",
	"study-playbook": "884ac5fa4ab21bb9e6ab221eee6f0bf6f01d81da40d7e4c51315e62e2948c7d9",
	"update-playbook": "06d4b538fb870eec652fec875b62856b1cee6bab0056f635d9525a69f4ac60b3",
	"research-index": "6162c299a13af5fc55d9ec96a97f9051df3865e652f9085cdd1c5bf2d70da3c0",
	"kanban-index": "44ec6da0282c586b76297338a609fed95b2e4508a2564a0c288d1ae2f4c05b2d",
	"kanban-create": "17f7d901d052c6c6eec439bc2756222a5cc58b14a8b29a456442a51e429fd0f0",
	"kanban-work": "871d4600849539076d5b05dce79c4f99e8b433c6097c9cc8195fa3c54a193813",
	"kanban-manage": "1f070236a6af4b4ab6f2da2e1babd609cda9d2db54033e70e345e794d2ef0539",
	"kanban-move": "f4ba29b3595f8dbe473dd182da550dda2d75a91b2252c50d1359217435d87dfd",
	"kanban-complete": "ba45d419ea52a04b4b3ce0513af01e2db09a8d5ac4d8d098d23f9ccc489f30de",
	"kanban-stash": "e8c25a8952eadd6bbdbba014184912d0b296839fcedab9f22281906ef043e181",
	"kanban-review": "53a94eba8d2e50396b1f621bcf332119e78425bed7ea28bc3f1bc6a247f5af5b",
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
