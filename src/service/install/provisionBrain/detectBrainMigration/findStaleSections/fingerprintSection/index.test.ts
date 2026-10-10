import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import fingerprintSection from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "..", "..", "__fixtures__", "v0.9.0-brain.txt");

const text = "First line\n\n  indented line\nlast line";

describe("fingerprintSection", () => {
	it("returns 64 lowercase hex characters", () => {
		expect(fingerprintSection(text)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("gives LF, CRLF and CR versions the same fingerprint", () => {
		const expected = fingerprintSection(text);
		expect(fingerprintSection(text.replace(/\n/g, "\r\n"))).toBe(expected);
		expect(fingerprintSection(text.replace(/\n/g, "\r"))).toBe(expected);
	});

	it("ignores trailing spaces and tabs on lines", () => {
		const padded = "First line  \n\t\n  indented line\t \nlast line \t";
		expect(fingerprintSection(padded)).toBe(fingerprintSection(text));
	});

	it("ignores extra leading and trailing blank lines", () => {
		expect(fingerprintSection(`\n\n${text}\n\n\n`)).toBe(fingerprintSection(text));
	});

	it("changes on a one-word change", () => {
		expect(fingerprintSection(text.replace("last", "final"))).not.toBe(fingerprintSection(text));
	});

	it("changes when an internal blank line changes", () => {
		expect(fingerprintSection(text.replace("\n\n", "\n"))).not.toBe(fingerprintSection(text));
	});

	it("changes when indentation changes", () => {
		expect(fingerprintSection(text.replace("  indented", "    indented"))).not.toBe(fingerprintSection(text));
	});

	it("matches the golden fingerprint of the v0.9.0 config section", () => {
		const parsed = parseBrainAideFromString(readFileSync(fixturePath, "utf8"));
		if (parsed.kind !== "missing-sections") throw new Error(`unexpected parse kind ${parsed.kind}`);
		expect(fingerprintSection(parsed.present.config!)).toBe(
			"a5eda127c05487ec925e7a5c5f23b7027e5366b1f1d65cab8e1de896ede63d83",
		);
	});
});
