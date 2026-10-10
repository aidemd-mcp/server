import { describe, it, expect } from "vitest";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import locateFrontmatter from "../../../locateFrontmatter/index.js";
import toLineEnding from "../../../toLineEnding/index.js";
import rewriteLauncherArgs from "./index.js";

const OLD_SPEC = "@bitbonsai/mcpvault@0.9.0";
const NEW_SPEC = "@bitbonsai/mcpvault@0.16.0";
const VAULT_PATH = "D:/vault";

/** A frontmatter region (LF) with the given command and raw args lines. */
function makeRegion({ command, argLines }: { command: string; argLines: string[] }): string {
	return `name: brain\nmcpServerConfig:\n  command: ${command}\n  args:\n${argLines.join("\n")}\nafter: kept\n`;
}

const win32Lines = ["    - '/c'", "    - 'npx'", `    - '${OLD_SPEC}'`, `    - '${VAULT_PATH}'`];

describe("rewriteLauncherArgs", () => {
	it("inserts -y before the spec, re-pins it and keeps the other lines byte-identical (win32)", () => {
		const frontmatter = makeRegion({ command: "cmd", argLines: win32Lines });
		const result = rewriteLauncherArgs({
			frontmatter,
			before: ["/c", "npx", OLD_SPEC, VAULT_PATH],
			after: ["/c", "npx", "-y", NEW_SPEC, VAULT_PATH],
			eol: "\n",
		});

		expect(result).toBe(
			makeRegion({
				command: "cmd",
				argLines: ["    - '/c'", "    - 'npx'", "    - '-y'", `    - '${NEW_SPEC}'`, `    - '${VAULT_PATH}'`],
			}),
		);
	});

	it("rewrites the POSIX shape", () => {
		const frontmatter = makeRegion({ command: "npx", argLines: [`    - '${OLD_SPEC}'`, `    - '${VAULT_PATH}'`] });
		const result = rewriteLauncherArgs({
			frontmatter,
			before: [OLD_SPEC, VAULT_PATH],
			after: ["-y", NEW_SPEC, VAULT_PATH],
			eol: "\n",
		});

		expect(result).toBe(
			makeRegion({ command: "npx", argLines: ["    - '-y'", `    - '${NEW_SPEC}'`, `    - '${VAULT_PATH}'`] }),
		);
	});

	it("only inserts -y when the spec is already pinned, keeping the spec line verbatim", () => {
		const frontmatter = makeRegion({
			command: "npx",
			argLines: [`    - "${NEW_SPEC}"`, `    - ${VAULT_PATH}`],
		});
		const result = rewriteLauncherArgs({
			frontmatter,
			before: [NEW_SPEC, VAULT_PATH],
			after: ["-y", NEW_SPEC, VAULT_PATH],
			eol: "\n",
		});

		expect(result).toBe(
			makeRegion({ command: "npx", argLines: ["    - '-y'", `    - "${NEW_SPEC}"`, `    - ${VAULT_PATH}`] }),
		);
	});

	it("escapes a single quote in an inserted value", () => {
		const frontmatter = makeRegion({ command: "npx", argLines: [`    - '${OLD_SPEC}'`] });
		const result = rewriteLauncherArgs({ frontmatter, before: [OLD_SPEC], after: ["it's"], eol: "\n" });

		expect(result).toBe(makeRegion({ command: "npx", argLines: ["    - 'it''s'"] }));
	});

	it("writes new lines with CRLF in a CRLF region and leaves unchanged lines alone", () => {
		const frontmatter = toLineEnding({
			text: makeRegion({ command: "npx", argLines: [`    - '${OLD_SPEC}'`, `    - '${VAULT_PATH}'`] }),
			eol: "\r\n",
		});
		const result = rewriteLauncherArgs({
			frontmatter,
			before: [OLD_SPEC, VAULT_PATH],
			after: ["-y", NEW_SPEC, VAULT_PATH],
			eol: "\r\n",
		});

		expect(result).toBe(
			toLineEnding({
				text: makeRegion({ command: "npx", argLines: ["    - '-y'", `    - '${NEW_SPEC}'`, `    - '${VAULT_PATH}'`] }),
				eol: "\r\n",
			}),
		);
		expect(result!.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
	});

	it("keeps a null path slot (bare dash) verbatim", () => {
		const frontmatter = makeRegion({ command: "npx", argLines: [`    - '${OLD_SPEC}'`, "    -"] });
		const result = rewriteLauncherArgs({
			frontmatter,
			before: [OLD_SPEC, null],
			after: ["-y", NEW_SPEC, null],
			eol: "\n",
		});

		expect(result).toBe(makeRegion({ command: "npx", argLines: ["    - '-y'", `    - '${NEW_SPEC}'`, "    -"] }));
	});

	it("keeps a null path slot verbatim when it is followed by another key", () => {
		const frontmatter = "mcpServerConfig:\n  command: npx\n  args:\n    - 'old'\n    -\nname: brain\n";
		const result = rewriteLauncherArgs({ frontmatter, before: ["old", null], after: ["new", null], eol: "\n" });

		expect(result).toBe("mcpServerConfig:\n  command: npx\n  args:\n    - 'new'\n    -\nname: brain\n");
	});

	it("returns null for flow-style args", () => {
		const frontmatter = "mcpServerConfig:\n  command: npx\n  args: ['a', 'b']\n";
		expect(rewriteLauncherArgs({ frontmatter, before: ["a", "b"], after: ["-y", "a", "b"], eol: "\n" })).toBeNull();
	});

	it("returns null when an item spans several lines", () => {
		const frontmatter = "mcpServerConfig:\n  command: npx\n  args:\n    - 'a\n      b'\n    - 'c'\n";
		expect(rewriteLauncherArgs({ frontmatter, before: ["a b", "c"], after: ["-y", "a b", "c"], eol: "\n" })).toBeNull();
	});

	it("returns null when the parsed args differ from the expected before list", () => {
		const frontmatter = makeRegion({ command: "npx", argLines: ["    - 'a'"] });
		expect(rewriteLauncherArgs({ frontmatter, before: ["different"], after: ["x"], eol: "\n" })).toBeNull();
	});

	it("returns null when there is no mcpServerConfig.args", () => {
		expect(rewriteLauncherArgs({ frontmatter: "name: brain\n", before: ["a"], after: ["b"], eol: "\n" })).toBeNull();
	});

	it("rewrites the bundled template's own CRLF frontmatter region, changing only the spec line", () => {
		const raw = toLineEnding({ text: obsidianBrainAideTemplate(), eol: "\r\n" });
		const { yamlStart, yamlEnd } = locateFrontmatter(raw);
		const region = raw.slice(yamlStart, yamlEnd);
		const specLine = region.split("\r\n").find((line) => line.includes("@bitbonsai/mcpvault@"))!;
		const spec = /'([^']+)'/.exec(specLine)![1]!;

		const posix = rewriteLauncherArgs({ frontmatter: region, before: ["-y", spec, null], after: ["-y", "pkg@2", null], eol: "\r\n" });
		const win32 = rewriteLauncherArgs({
			frontmatter: region,
			before: ["/c", "npx", "-y", spec, null],
			after: ["/c", "npx", "-y", "pkg@2", null],
			eol: "\r\n",
		});

		expect(posix ?? win32).toBe(region.replace(spec, "pkg@2"));
	});
});
