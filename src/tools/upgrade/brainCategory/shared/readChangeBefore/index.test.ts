import { describe, it, expect } from "vitest";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import toLineEnding from "../toLineEnding/index.js";
import readChangeBefore from "./index.js";

describe.each([
	["LF", "\n" as const],
	["CRLF", "\r\n" as const],
])("readChangeBefore (%s file)", (_label, eol) => {
	const raw = toLineEnding({ text: obsidianBrainAideTemplate(), eol });
	const parse = parseBrainAideFromString(raw);

	it("returns the frontmatter region for the launcher", () => {
		const before = readChangeBefore({ raw, target: "launcher" });
		expect(before).not.toBeNull();
		expect(before!.startsWith("name:")).toBe(true);
		expect(before!.endsWith(eol)).toBe(true);
		expect(raw.startsWith(`---${eol}${before}---`)).toBe(true);
	});

	it.each(brainContract.map(({ marker, field }) => [marker, field] as const))(
		"returns the parser's bytes for the %s section",
		(marker, field) => {
			if (parse.kind !== "ok") throw new Error("fixture must parse ok");
			expect(readChangeBefore({ raw, target: marker })).toBe(parse[field]);
		},
	);

	it("returns null for a section whose markers are gone", () => {
		const { marker } = brainContract[0]!;
		const { open, close } = toMarkerPair(marker);
		const stripped = raw.replace(open, "").replace(close, "");
		expect(readChangeBefore({ raw: stripped, target: marker })).toBeNull();
	});
});
