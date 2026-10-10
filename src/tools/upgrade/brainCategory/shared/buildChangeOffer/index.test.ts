import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate, { MCPVAULT_VERSION } from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import parseBundledTemplate from "@/service/install/provisionBrain/parseBundledTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import locateFrontmatter from "../locateFrontmatter/index.js";
import toLineEnding from "../toLineEnding/index.js";
import buildChangeOffer from "./index.js";

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
);
const v090 = readFileSync(fixturePath, "utf8");
const template = parseBundledTemplate();

/** The v0.9.0 fixture in CRLF. */
function crlfFixture(): string {
	return toLineEnding({ text: v090, eol: "\r\n" });
}

const offerFor = (raw: string, target: Parameters<typeof buildChangeOffer>[0]["target"]) =>
	buildChangeOffer({ raw, parse: parseBrainAideFromString(raw), target });

describe("buildChangeOffer", () => {
	it("offers a stale section: before is the parser's bytes, after is the template section", () => {
		const parse = parseBrainAideFromString(v090);
		if (parse.kind !== "missing-sections") throw new Error("fixture must parse as missing-sections");

		const offer = offerFor(v090, "orientation");
		if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

		expect(offer.target).toBe("orientation");
		expect(offer.before).toBe(parse.present.orientation);
		expect(offer.after).toBe(template.orientation);
		expect(parseBrainAideFromString(offer.text)).toMatchObject({
			kind: "missing-sections",
			present: { orientation: template.orientation },
		});
	});

	it("changes only the replaced span of the file", () => {
		const offer = offerFor(v090, "config");
		if (offer.kind !== "offer") throw new Error("expected an offer");

		const { open, close } = toMarkerPair("config");
		const start = v090.indexOf(open) + open.length;
		const end = v090.indexOf(close);
		expect(offer.text.slice(0, start)).toBe(v090.slice(0, start));
		expect(offer.text.slice(start, start + offer.after.length)).toBe(offer.after);
		expect(offer.text.slice(start + offer.after.length)).toBe(v090.slice(end));
	});

	it("offers the launcher with args rewritten to the pinned local launcher", () => {
		const offer = offerFor(v090, "launcher");
		if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

		const { yamlStart, yamlEnd } = locateFrontmatter(v090);
		expect(offer.before).toBe(v090.slice(yamlStart, yamlEnd));
		expect(offer.after).toBe(
			offer.before.replace(
				"    - '@bitbonsai/mcpvault'\n",
				`    - '-y'\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\n`,
			),
		);
		expect(offer.text).toBe(v090.slice(0, yamlStart) + offer.after + v090.slice(yamlEnd));
		const reparsed = parseBrainAideFromString(offer.text);
		expect(reparsed.kind).toBe("missing-sections");
		expect(reparsed.kind === "missing-sections" && reparsed.mcpServerConfig).toEqual({
			command: "cmd",
			args: ["/c", "npx", "-y", `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`, "C:\\vault"],
		});
	});

	it("refuses a customized section (R5)", () => {
		const reworded = v090.replace(/(<!-- aide-config-start -->[\s\S]*?)the/, "$1THE");
		expect(reworded).not.toBe(v090);

		expect(offerFor(reworded, "config")).toEqual({
			kind: "refused",
			instructions:
				"Section `config` matches no outdated template version (it is current or customized), so no change is offered.",
		});
	});

	it("refuses the current template section (R5)", () => {
		const offer = offerFor(obsidianBrainAideTemplate(), "orientation");
		expect(offer.kind).toBe("refused");
		expect(offer.kind === "refused" && offer.instructions).toContain("matches no outdated template version");
	});

	it("refuses a stale section under a non-template launcher (R6)", () => {
		const foreign = v090.replace("'@bitbonsai/mcpvault'", "'some-other-brain-server'");
		expect(foreign).not.toBe(v090);

		expect(offerFor(foreign, "orientation")).toEqual({
			kind: "refused",
			instructions:
				"Section `orientation` is an outdated template version, but this config launches a different brain server than the bundled template targets, so the template's text is not offered. Review it with the user by hand.",
		});
	});

	it("refuses the launcher when it is current (R7)", () => {
		expect(offerFor(obsidianBrainAideTemplate(), "launcher")).toEqual({
			kind: "refused",
			instructions: "The brain launcher is current or custom, so no launcher change is offered.",
		});
	});

	it("refuses a section whose markers are gone (R9)", () => {
		const { open, close } = toMarkerPair("config");
		const stripped = v090.replace(open, "").replace(close, "");
		const offer = buildChangeOffer({ raw: stripped, parse: parseBrainAideFromString(v090), target: "config" });

		expect(offer.kind === "refused" && offer.instructions).toBe(
			'The `config` text changed after its diff was shown, so nothing was written. Fetch the diff again with `aide_upgrade`, `category: "brain"` and `brainChange: "config"` (no `beforeHash`), show it to the user, and apply only on their yes.',
		);
	});

	it("carries CRLF in after and text for a CRLF file", () => {
		const crlf = crlfFixture();

		const section = offerFor(crlf, "orientation");
		if (section.kind !== "offer") throw new Error("expected a section offer");
		expect(section.after).toBe(toLineEnding({ text: template.orientation, eol: "\r\n" }));
		expect(section.text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);

		const launcher = offerFor(crlf, "launcher");
		if (launcher.kind !== "offer") throw new Error("expected a launcher offer");
		expect(launcher.after).toContain(`    - '-y'\r\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\r\n`);
		expect(launcher.text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
	});

	it("throws on an unusable parse", () => {
		expect(() => buildChangeOffer({ raw: "", parse: { kind: "missing" }, target: "launcher" })).toThrow(
			"requires a usable parse",
		);
	});
});
