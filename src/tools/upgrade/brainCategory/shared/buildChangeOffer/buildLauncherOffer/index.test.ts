import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MCPVAULT_VERSION } from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import toLineEnding from "../../toLineEnding/index.js";
import buildLauncherOffer from "./index.js";

const v090 = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	),
	"utf8",
);

const build = (raw: string, eol: "\r\n" | "\n" = "\n") =>
	buildLauncherOffer({ raw, parse: parseBrainAideFromString(raw), eol });

describe("buildLauncherOffer", () => {
	it("inserts -y before the re-pinned spec and keeps the other arg lines", () => {
		const offer = build(v090);
		if (offer.kind !== "offer") throw new Error(`expected an offer, got: ${offer.instructions}`);

		expect(offer.target).toBe("launcher");
		expect(offer.after).toBe(
			`name: obsidian\nmcpServerConfig:\n  command: cmd\n  args:\n    - '/c'\n    - 'npx'\n    - '-y'\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\n    - 'C:\\vault'\n`,
		);
		expect(offer.text.endsWith(v090.slice(v090.indexOf("\n---\n") + 1))).toBe(true);
	});

	it("refuses flow-style args with the replacement args for a hand edit (R8)", () => {
		const flow = v090.replace(/ {2}args:\n(?: {4}- .*\n)+/, "  args: ['/c', 'npx', '@bitbonsai/mcpvault', 'C:\\vault']\n");
		expect(flow).not.toBe(v090);

		expect(build(flow)).toEqual({
			kind: "refused",
			instructions: `The launcher change cannot be applied byte-safely because \`mcpServerConfig.args\` is not a YAML block list with one entry per line. Show the user the replacement args ${JSON.stringify(["/c", "npx", "-y", `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`, "C:\\vault"])} and, on their yes, edit them by hand; then re-check brain state with \`aide_info\`.`,
		});
	});

	it("refuses a launcher that is not legacy (R7)", () => {
		const current = v090.replace(
			"    - '@bitbonsai/mcpvault'\n",
			`    - '-y'\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\n`,
		);

		expect(build(current)).toEqual({
			kind: "refused",
			instructions: "The brain launcher is current or custom, so no launcher change is offered.",
		});
	});

	it("writes new lines in the file's line ending", () => {
		const crlf = toLineEnding({ text: v090, eol: "\r\n" });
		const offer = build(crlf, "\r\n");
		if (offer.kind !== "offer") throw new Error("expected an offer");

		expect(offer.after.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		expect(offer.after).toContain("    - '-y'\r\n");
	});
});
