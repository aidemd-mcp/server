import { describe, it, expect } from "vitest";
import selectSection from "./index.js";
import brainContract from "@/service/brainContract/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";
import type { BrainSectionField, ParseBrainAideResult } from "@/types/index.js";

/** Section bytes with placeholders, CRLF and blank edges, so any transformation shows up as a byte difference. */
function makeBytes(marker: string): string {
	return `\r\n\r\n${marker} body with \${PLACEHOLDER} and \${brain.root}\r\nsecond line\r\n\r\n`;
}

function makeSections(): Record<BrainSectionField, string> {
	return Object.fromEntries(brainContract.map((entry) => [entry.field, makeBytes(entry.marker)])) as Record<
		BrainSectionField,
		string
	>;
}

const MCP_SERVER_CONFIG = { command: "node", args: ["server.js"] };

function makeOkParse(): ParseBrainAideResult {
	return { kind: "ok", name: "Test Brain", mcpServerConfig: MCP_SERVER_CONFIG, ...makeSections() };
}

describe("selectSection", () => {
	it.each(brainContract.map((entry) => entry.marker))("returns the %s bytes untouched on an ok parse", (marker) => {
		const section = selectSection({ parse: makeOkParse(), marker });
		expect(section).toBe(makeBytes(marker));
	});

	describe("missing-sections parse", () => {
		const [presentEntry, absentEntry] = brainContract;
		const parse: ParseBrainAideResult = {
			kind: "missing-sections",
			sections: [absentEntry.marker],
			name: "Test Brain",
			mcpServerConfig: MCP_SERVER_CONFIG,
			present: { [presentEntry.field]: makeBytes(presentEntry.marker) },
		};

		it("returns the present section's bytes untouched", () => {
			expect(selectSection({ parse, marker: presentEntry.marker })).toBe(makeBytes(presentEntry.marker));
		});

		it("returns undefined for an absent section", () => {
			expect(selectSection({ parse, marker: absentEntry.marker })).toBeUndefined();
		});
	});

	describe.each([
		["missing", { kind: "missing" }],
		["unreadable", { kind: "unreadable", reason: "EACCES" }],
		["malformed-frontmatter", { kind: "malformed-frontmatter", reason: "bad yaml" }],
		["malformed-body", { kind: "malformed-body", reason: "unterminated marker" }],
	] as [string, ParseBrainAideResult][])("%s parse", (_kind, parse) => {
		it.each(brainContract.map((entry) => entry.marker))("returns undefined for %s", (marker: BrainSectionMarker) => {
			expect(selectSection({ parse, marker })).toBeUndefined();
		});
	});
});
