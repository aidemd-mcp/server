import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionField, ParseBrainAideResult } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import parseBundledTemplate from "../../parseBundledTemplate/index.js";
import findStaleSections from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "__fixtures__");

function readFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf8");
}

function sectionsOf(parse: ParseBrainAideResult): Partial<Record<BrainSectionField, string>> {
	if (parse.kind === "ok") return Object.fromEntries(brainContract.map((e) => [e.field, parse[e.field]]));
	if (parse.kind === "missing-sections") return parse.present;
	throw new Error(`fixture did not parse usably: ${parse.kind}`);
}

const template = parseBundledTemplate();
const v090 = sectionsOf(parseBrainAideFromString(readFixture("v0.9.0-brain.txt")));
const repo = sectionsOf(parseBrainAideFromString(readFixture("aidemd-repo-2026-10-09-brain.txt")));
const markers = (sections: Partial<Record<BrainSectionField, string>>) =>
	findStaleSections({ sections, template }).map((offer) => offer.marker);

describe("findStaleSections", () => {
	it("flags orientation and config of the v0.9.0 fixture, in contract order, with verbatim before/after", () => {
		const offers = findStaleSections({ sections: v090, template });
		expect(offers.map((o) => o.marker)).toEqual(["orientation", "config"]);
		expect(offers[0].before).toBe(v090.orientation);
		expect(offers[0].after).toBe(template.orientation);
		expect(offers[1].before).toBe(v090.config);
		expect(offers[1].after).toBe(template.config);
	});

	it("does not flag update-playbook of the v0.9.0 fixture, which equals today's", () => {
		expect(markers(v090)).not.toContain("update-playbook");
	});

	it("flags orientation, config and update-playbook of the repo fixture", () => {
		const offers = findStaleSections({ sections: repo, template });
		expect(offers.map((o) => o.marker)).toEqual(["orientation", "config", "update-playbook"]);
		const config = offers.find((o) => o.marker === "config")!;
		expect(config.before).toContain("<BRAIN_PATH>");
		expect(config.after).not.toContain("<BRAIN_PATH>");
	});

	it("never flags a user-customized section", () => {
		const customized = { ...v090, config: v090.config!.replace("the", "THE") };
		expect(customized.config).not.toBe(v090.config);
		expect(markers(customized)).toEqual(["orientation"]);
	});

	it("still recognises a CRLF, trailing-space version of the v0.9.0 sections", () => {
		const noisy = Object.fromEntries(
			Object.entries(v090).map(([field, text]) => [field, text!.replace(/\n/g, "  \r\n")]),
		) as Partial<Record<BrainSectionField, string>>;
		const offers = findStaleSections({ sections: noisy, template });
		expect(offers.map((o) => o.marker)).toEqual(["orientation", "config"]);
		expect(offers[0].before).toBe(noisy.orientation);
	});

	it("returns nothing for every current template section", () => {
		expect(findStaleSections({ sections: template, template })).toEqual([]);
	});

	it("skips fields absent from sections", () => {
		expect(findStaleSections({ sections: {}, template })).toEqual([]);
	});
});
