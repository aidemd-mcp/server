import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { BrainAideConfig, ParseBrainAideResult } from "@/types/index.js";

/**
 * Returns a copy of `config.mcpServerConfig.args` with every `${fieldName}` placeholder
 * substituted against the top-level frontmatter fields. `${name}` is the only field the
 * current schema resolves; unknown keys (any `${something-not-in-the-map}`) pass through
 * verbatim.
 *
 * The default scaffold contains no placeholders — this helper is a no-op for the canonical
 * install. Advanced users can embed `${name}` in their `args` to inject the brain's name
 * at install time (e.g. `["some-launcher", "--profile", "${name}"]`).
 *
 * Audience: install-time callers only — this is the `.mcp.json`-writer surface, never
 * the agent-facing surface. It is the ONLY substitution surface in the package:
 * no other function in the codebase replaces placeholders in brain.aide content.
 * The prose body is never passed through here and must never be interpolated.
 */
export function interpolateArgs(config: BrainAideConfig): string[] {
	const substitutions: Record<string, string> = {
		name: config.name,
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
 *
 * Validation order: required fields are checked first (`name`, `mcpServerConfig`,
 * `mcpServerConfig.command`, `mcpServerConfig.args`), then deprecated fields
 * (`connector`, `rootPath`, `entryFile`, `tools`) are rejected as
 * `malformed-frontmatter` with a reason listing every stale field found, in
 * deprecated-set order. This sequencing ensures a user missing a required field
 * sees the actionable required-field error before any deprecated-field error.
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

	// Step 4: Validate required fields. Each failure short-circuits with a reason naming the field.
	// Order: name → mcpServerConfig (object) → mcpServerConfig.command → mcpServerConfig.args.
	if (typeof fm["name"] !== "string" || fm["name"].trim() === "") {
		return { kind: "malformed-frontmatter", reason: "name is required and must be a non-empty string" };
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

	// Step 4b: Reject deprecated fields. Runs AFTER required-field validation so a user
	// missing a required field sees that error first. Deprecated fields are listed in
	// fixed set order (not user-file order) for deterministic output.
	const DEPRECATED_FIELDS = ["connector", "rootPath", "entryFile", "tools"] as const;
	const foundDeprecated = DEPRECATED_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(fm, key));
	if (foundDeprecated.length > 0) {
		return { kind: "malformed-frontmatter", reason: `deprecated fields: ${foundDeprecated.join(", ")}` };
	}

	// Step 4c: Construct the validated config — exactly the two top-level fields.
	const config: BrainAideConfig = {
		name: fm["name"],
		mcpServerConfig: {
			command: mcpServerConfig["command"],
			args: mcpServerConfig["args"] as string[],
		},
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
 * Reads `.aide/config/brain.aide` from the given host project root and parses it into a
 * tagged-result union. The brain.aide path is derived as `join(root, ".aide", "config", "brain.aide")`.
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
 * - Never branches on `name` — the field is surfaced unchanged for consumers to use.
 */
export default async function parseBrainAide(root: string): Promise<ParseBrainAideResult> {
	// Step 1: Read the file. ENOENT and other I/O failures both collapse to `missing` —
	// the file is unreachable in either case and remediation is the same.
	const brainAidePath = join(root, ".aide", "config", "brain.aide");

	let content: string;
	try {
		content = await readFile(brainAidePath, "utf-8");
	} catch {
		return { kind: "missing" };
	}

	// Delegate to the string parser for steps 2–6.
	return parseBrainAideFromString(content);
}
