import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import locateFrontmatter from "../locateFrontmatter/index.js";
import toLineEnding from "../toLineEnding/index.js";
import locateSection from "./index.js";

describe.each([
	["LF", "\n" as const],
	["CRLF", "\r\n" as const],
])("locateSection (%s file)", (_label, eol) => {
	const raw = toLineEnding({ text: obsidianBrainAideTemplate(), eol });
	const parse = parseBrainAideFromString(raw);
	const { bodyStart } = locateFrontmatter(raw);

	it("parses the fixture ok", () => {
		expect(parse.kind).toBe("ok");
	});

	it.each(brainContract.map(({ marker, field }) => [marker, field] as const))(
		"returns the parser's bytes for %s",
		(marker, field) => {
			if (parse.kind !== "ok") throw new Error("fixture must parse ok");
			const span = locateSection({ raw, bodyStart, marker });
			expect(span).not.toBeNull();
			expect(raw.slice(span!.start, span!.end)).toBe(parse[field]);
		},
	);

	it("returns null when the section's markers are absent", () => {
		const { marker } = brainContract[0]!;
		const { open, close } = toMarkerPair(marker);
		const stripped = raw.replace(open, "").replace(close, "");
		expect(locateSection({ raw: stripped, bodyStart, marker })).toBeNull();
	});

	it("returns null when only the open marker is present", () => {
		const { marker } = brainContract[0]!;
		const { close } = toMarkerPair(marker);
		expect(locateSection({ raw: raw.replace(close, ""), bodyStart, marker })).toBeNull();
	});

	it("ignores a marker pair that sits before bodyStart", () => {
		const { marker } = brainContract[0]!;
		const { open, close } = toMarkerPair(marker);
		// A YAML comment line inside the frontmatter carries a full pair: it sits before bodyStart.
		const prefixed = raw.replace("name:", `# ${open}decoy${close}${eol}name:`);
		const shifted = locateFrontmatter(prefixed);
		const span = locateSection({ raw: prefixed, bodyStart: shifted.bodyStart, marker });
		expect(prefixed.slice(span!.start, span!.end)).not.toBe("decoy");
	});
});
