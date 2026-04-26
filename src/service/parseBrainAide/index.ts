import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { BrainAideConfig, ParseBrainAideResult } from "@/types/index.js";

/**
 * Returns a copy of `config.mcpServerConfig.args` with every `${<key>}` placeholder
 * substituted by the corresponding value from the config. Currently supports
 * `${rootPath}` and `${entryFile}`.
 *
 * Audience: install-time callers only — this is the `.mcp.json`-writer surface, never
 * the agent-facing surface. It is the ONLY substitution surface in the package:
 * no other function in the codebase replaces placeholders in brain.aide content.
 * The prose body is never passed through here and must never be interpolated.
 */
export function interpolateArgs(config: BrainAideConfig): string[] {
	const substitutions: Record<string, string> = {
		rootPath: config.rootPath,
		entryFile: config.entryFile,
	};

	return config.mcpServerConfig.args.map((arg) =>
		arg.replace(/\$\{(\w+)\}/g, (match, key: string) => {
			return Object.prototype.hasOwnProperty.call(substitutions, key) ? substitutions[key] : match;
		}),
	);
}

/**
 * Parses brain.aide bytes already in memory — no I/O. Implements steps 2–6 of the
 * parser pipeline so that `parseBrainAide` becomes a thin file-reading wrapper.
 * Used by `provisionBrain` (Plan 6) to derive an MCP entry from a scaffolded
 * template that has not been written to disk yet.
 *
 * Returns the same `ParseBrainAideResult` union as `parseBrainAide`. The `"missing"`
 * variant is unreachable (the input is bytes, not a path): empty input returns
 * `{ kind: "malformed-frontmatter", reason: "frontmatter is required" }`.
 */
export function parseBrainAideFromString(content: string): ParseBrainAideResult {
	// Step 2: Split on first `---\n` opening fence.
	// The file must start with the opening fence; content before it is discarded.
	if (!content.trim()) {
		return { kind: "malformed-frontmatter", reason: "frontmatter is required" };
	}

	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		return { kind: "malformed-frontmatter", reason: "frontmatter is required" };
	}

	// Slice past the opening `---` and find the closing `---` fence.
	const afterOpen = trimmed.slice(3);
	const closeIndex = afterOpen.indexOf("\n---");
	if (closeIndex === -1) {
		return { kind: "malformed-frontmatter", reason: "frontmatter closing fence (---) is missing" };
	}

	const yamlBlock = afterOpen.slice(0, closeIndex);
	// Body is everything after the closing `---\n`.
	const body = afterOpen.slice(closeIndex + 4).replace(/^\n/, "");

	// Step 3: Parse frontmatter via `yaml`. Failure or non-object → malformed-frontmatter.
	let parsed: unknown;
	try {
		parsed = parse(yamlBlock);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { kind: "malformed-frontmatter", reason: message };
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return { kind: "malformed-frontmatter", reason: "frontmatter must be a YAML object" };
	}

	const fm = parsed as Record<string, unknown>;

	// Step 4: Validate required fields by name. Each failure names exactly which field is wrong.
	if (typeof fm["connector"] !== "string" || fm["connector"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "connector is required and must be a non-empty string" };
	}

	if (typeof fm["rootPath"] !== "string" || fm["rootPath"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "rootPath is required and must be a non-empty string" };
	}

	if (typeof fm["entryFile"] !== "string" || fm["entryFile"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "entryFile is required and must be a non-empty string" };
	}

	if (!fm["mcpServerConfig"] || typeof fm["mcpServerConfig"] !== "object" || Array.isArray(fm["mcpServerConfig"])) {
		return { kind: "malformed-frontmatter", reason: "mcpServerConfig is required and must be an object" };
	}

	const mcpServerConfig = fm["mcpServerConfig"] as Record<string, unknown>;

	if (typeof mcpServerConfig["command"] !== "string" || mcpServerConfig["command"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "mcpServerConfig.command is required and must be a non-empty string" };
	}

	if (!Array.isArray(mcpServerConfig["args"]) || !mcpServerConfig["args"].every((a) => typeof a === "string")) {
		return { kind: "malformed-frontmatter", reason: "mcpServerConfig.args is required and must be an array of strings" };
	}

	if (!fm["tools"] || typeof fm["tools"] !== "object" || Array.isArray(fm["tools"])) {
		return { kind: "malformed-frontmatter", reason: "tools is required and must be an object" };
	}

	const tools = fm["tools"] as Record<string, unknown>;

	if (typeof tools["read"] !== "string" || tools["read"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "tools.read is required and must be a non-empty string" };
	}

	if (typeof tools["search"] !== "string" || tools["search"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "tools.search is required and must be a non-empty string" };
	}

	// Validated config — construct the typed config object.
	const config: BrainAideConfig = {
		connector: fm["connector"],
		rootPath: fm["rootPath"],
		entryFile: fm["entryFile"],
		mcpServerConfig: {
			command: mcpServerConfig["command"],
			args: mcpServerConfig["args"] as string[],
		},
		tools: tools as Record<string, string>,
	};

	// Step 5: Find `## Prose` heading in the body. Everything after it (through EOF)
	// is the prose — byte-identical, no trimming. The heading must appear at the start
	// of a line (case-sensitive). Heading not found → malformed-body.
	const proseHeadingPattern = /^## Prose$/m;
	const headingMatch = proseHeadingPattern.exec(body);
	if (!headingMatch) {
		return { kind: "malformed-body", reason: "## Prose section is required" };
	}

	// Everything after the heading line through EOF. The heading line ends at the
	// match index + the length of "## Prose"; skip the following newline character.
	const headingEnd = headingMatch.index + headingMatch[0].length;
	const prose = body.slice(headingEnd).replace(/^\n/, "");

	// Step 6: Return the ok result.
	return { kind: "ok", config, prose };
}

/**
 * Reads `.aide/brain.aide` from the given host project root and parses it into a
 * tagged-result union. The brain.aide path is derived as `join(root, ".aide", "brain.aide")`.
 *
 * Result branches:
 * - `"ok"` — file found, frontmatter parsed, all required fields valid, `## Prose` located.
 * - `"missing"` — file does not exist or was unreachable (ENOENT or other I/O failure).
 *   Remediation is the same in both cases: run `/aide` and complete the brain wiring interview.
 * - `"malformed-frontmatter"` — file exists but YAML could not be parsed, or a required
 *   field is absent or wrong-typed. `reason` names exactly which field is wrong.
 * - `"malformed-body"` — frontmatter is valid but the `## Prose` heading is absent.
 *
 * Load-bearing invariants:
 * - Never throws — all failure modes return a tagged result.
 * - Never interpolates the prose body — the returned `prose` string is byte-identical
 *   to the file content after the `## Prose` heading. Call `interpolateArgs` separately
 *   when writing the MCP entry.
 * - Never branches on `connector` — the field is surfaced unchanged for consumers to use.
 */
export default async function parseBrainAide(root: string): Promise<ParseBrainAideResult> {
	// Step 1: Read the file. ENOENT and other I/O failures both collapse to `missing` —
	// the file is unreachable in either case and remediation is the same.
	const brainAidePath = join(root, ".aide", "brain.aide");

	let content: string;
	try {
		content = await readFile(brainAidePath, "utf-8");
	} catch {
		return { kind: "missing" };
	}

	// Delegate to the string parser for steps 2–6.
	return parseBrainAideFromString(content);
}
