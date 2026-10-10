import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import parseBundledTemplate from "@/service/install/provisionBrain/parseBundledTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import toLineEnding from "../../toLineEnding/index.js";
import buildSectionOffer from "./index.js";

const v090 = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	),
	"utf8",
);
const template = parseBundledTemplate();

describe("buildSectionOffer", () => {
	it("converts the template section to the file's line ending and splices it over the old bytes", () => {
		const raw = toLineEnding({ text: v090, eol: "\r\n" });
		const offer = buildSectionOffer({ raw, parse: parseBrainAideFromString(raw), marker: "config", eol: "\r\n" });
		if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

		expect(offer.after).toBe(toLineEnding({ text: template.config, eol: "\r\n" }));
		expect(offer.text.replace(offer.after, offer.before)).toBe(raw);
	});

	it("never offers a section that is not a known outdated version", () => {
		const reworded = v090.replace(/(<!-- aide-config-start -->[\s\S]*?)the/, "$1THE");
		const offer = buildSectionOffer({
			raw: reworded,
			parse: parseBrainAideFromString(reworded),
			marker: "config",
			eol: "\n",
		});

		expect(offer.kind).toBe("refused");
	});

	it("throws on an unusable parse", () => {
		expect(() =>
			buildSectionOffer({ raw: "", parse: { kind: "missing" }, marker: "config", eol: "\n" }),
		).toThrow("requires a usable parse");
	});
});
