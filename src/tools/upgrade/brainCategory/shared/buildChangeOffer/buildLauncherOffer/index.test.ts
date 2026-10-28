import { describe, it, expect } from "vitest";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import locateFrontmatter from "../../locateFrontmatter/index.js";
import toLineEnding from "../../toLineEnding/index.js";
import buildLauncherOffer from "./index.js";

type Kind = "posix" | "cmd";

/** A literal npx launcher frontmatter region (LF) ending in a vault path slot (`null` is a bare `-`). */
function npxRegion(kind: Kind, slot: string | null): string {
	return [
		"name: obsidian",
		"mcpServerConfig:",
		`  command: ${kind === "posix" ? "npx" : "cmd"}`,
		"  args:",
		...(kind === "posix" ? [] : ["    - '/c'", "    - 'npx'"]),
		"    - '-y'",
		"    - '@bitbonsai/mcpvault@0.9.0'",
		slot === null ? "    -" : `    - '${slot}'`,
		"",
	].join("\n");
}

/** The region the offer must produce: the global command and only the vault path slot. */
function globalRegion(slot: string | null): string {
	return ["name: obsidian", "mcpServerConfig:", "  command: mcpvault", "  args:", slot === null ? "    -" : `    - '${slot}'`, ""].join("\n");
}

/** The bundled template with its frontmatter replaced by `region`, in `eol` line endings. */
function rawWith(region: string, eol: "\r\n" | "\n"): string {
	const template = obsidianBrainAideTemplate();
	const { yamlStart, yamlEnd } = locateFrontmatter(template);
	return toLineEnding({ text: template.slice(0, yamlStart) + region + template.slice(yamlEnd), eol });
}

const build = (raw: string, eol: "\r\n" | "\n" = "\n") =>
	buildLauncherOffer({ raw, parse: parseBrainAideFromString(raw), eol });

const cases: { name: string; kind: Kind; slot: string | null }[] = [
	{ name: "POSIX npx with a null slot", kind: "posix", slot: null },
	{ name: "POSIX npx with a path", kind: "posix", slot: "D:\vault" },
	{ name: "cmd /c npx with a null slot", kind: "cmd", slot: null },
	{ name: "cmd /c npx with a path", kind: "cmd", slot: "D:\vault" },
];

describe("buildLauncherOffer", () => {
	describe.each(cases)("$name", ({ kind, slot }) => {
		it.each(["\n", "\r\n"] as const)("moves to the global mcpvault command, keeping every other byte (%j line endings)", (eol) => {
			const raw = rawWith(npxRegion(kind, slot), eol);
			const offer = build(raw, eol);
			if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

			expect(offer.target).toBe("launcher");
			expect(offer.before).toBe(toLineEnding({ text: npxRegion(kind, slot), eol }));
			expect(offer.after).toBe(toLineEnding({ text: globalRegion(slot), eol }));
			const { yamlStart, yamlEnd } = locateFrontmatter(raw);
			expect(offer.text).toBe(raw.slice(0, yamlStart) + offer.after + raw.slice(yamlEnd));
			expect(parseBrainAideFromString(offer.text)).toMatchObject({
				kind: "ok",
				mcpServerConfig: { command: "mcpvault", args: [slot] },
			});
		});
	});

	it("keeps the vault path line's original quoting", () => {
		const region = npxRegion("posix", "D:\vault").replace("- 'D:\vault'", "- D:/vault");
		const offer = build(rawWith(region, "\n"));
		if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

		expect(offer.after).toBe(globalRegion("D:\vault").replace("- 'D:\vault'", "- D:/vault"));
	});

	it("refuses flow-style args with the replacement launcher for a hand edit (R8)", () => {
		const flow = npxRegion("posix", "D:\vault").replace(/ {2}args:\n(?: {4}-.*\n)+/, "  args: ['-y', '@bitbonsai/mcpvault@0.9.0', 'D:\vault']\n");
		expect(flow).toContain("args: [");

		expect(build(rawWith(flow, "\n"))).toEqual({
			kind: "refused",
			instructions: `The launcher change cannot be applied byte-safely because \`mcpServerConfig.command\` is not a single-line scalar or \`mcpServerConfig.args\` is not a YAML block list with one entry per line. Show the user the replacement launcher ${JSON.stringify({ command: "mcpvault", args: ["D:\vault"] })} and, on their yes, edit it by hand; then re-check brain state with \`aide_info\`.`,
		});
	});

	it("refuses a multi-line command scalar (R8)", () => {
		const folded = npxRegion("posix", null).replace("  command: npx\n", "  command: >-\n    npx\n");

		const offer = build(rawWith(folded, "\n"));
		expect(offer.kind).toBe("refused");
		expect(offer.kind === "refused" && offer.instructions).toContain("not a single-line scalar");
	});

	it.each([
		["the bundled template", obsidianBrainAideTemplate()],
		["a global mcpvault launcher", rawWith(globalRegion("D:\vault"), "\n")],
	])("refuses %s as current or custom (R7)", (_name, raw) => {
		expect(build(raw)).toEqual({
			kind: "refused",
			instructions: "The brain launcher is current or custom, so no launcher change is offered.",
		});
	});
});
