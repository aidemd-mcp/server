import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { BrainAideConfig, ParseBrainAideResult } from "@/types/index.js";

/**
 * The closed vocabulary of valid top-level body headings in a brain.aide file, in canonical
 * declaration order. This constant is the single source of truth for the body grammar: the
 * walker iterates it to detect unknown headings, the missing-section reason builder iterates
 * it to produce deterministic output, and tests assert against it. A future heading addition
 * or rename is a one-line edit here.
 */
const REQUIRED_BODY_HEADINGS = ["## Prose", "## Playbook hub", "## Research hub"] as const;

/**
 * Walks the body of a brain.aide file and extracts the three required named sections.
 * Enforces a closed vocabulary: every `^## .+$` line must be one of the three required
 * headings; the first unknown heading returns `malformed-body`. If any required heading is
 * absent after the walk, returns `malformed-body` naming every missing section in
 * `REQUIRED_BODY_HEADINGS` order (so the user fixes all gaps in one edit). Section slices
 * are byte-identical to the content between the heading's terminating newline and the next
 * heading line (or end-of-file for the last section). A single leading newline is stripped
 * from `prose` only for backward-compat with pre-widening test assertions.
 */
function extractBodySections(body: string):
	| { kind: "ok"; prose: string; playbookHub: string; researchHub: string }
	| { kind: "malformed-body"; reason: string } {
	// Scan for every `^## .+$` line and record its heading text plus the byte index
	// immediately after the heading line's terminating newline (where the section content begins).
	const headingRegex = /^## .+$/gm;
	const sections: { heading: string; startIndex: number }[] = [];
	let match: RegExpExecArray | null;

	while ((match = headingRegex.exec(body)) !== null) {
		const heading = match[0];
		// startIndex is the byte offset immediately after the heading line's newline.
		// match.index is the start of the heading; match[0].length is the heading text length;
		// +1 skips the trailing newline character.
		const startIndex = match.index + heading.length + 1;
		sections.push({ heading, startIndex });
	}

	// Closed-vocabulary rejection: the first heading not in the required set terminates the walk.
	const requiredSet = new Set<string>(REQUIRED_BODY_HEADINGS);
	for (const { heading } of sections) {
		if (!requiredSet.has(heading)) {
			return { kind: "malformed-body", reason: `unknown heading: ${heading}` };
		}
	}

	// Required-section presence check: collect every missing heading in REQUIRED_BODY_HEADINGS order.
	const foundHeadings = new Set(sections.map((s) => s.heading));
	const missing = REQUIRED_BODY_HEADINGS.filter((h) => !foundHeadings.has(h));
	if (missing.length > 0) {
		return { kind: "malformed-body", reason: `missing required sections: ${missing.join(", ")}` };
	}

	// Section slicing: for each required heading, slice from its startIndex to the start of the
	// next heading line or end-of-file. `startIndex` was stored as `match.index + heading.length + 1`,
	// so `match.index` (the heading line's start) is recoverable as `startIndex - heading.length - 1`.
	// The upper bound for a section is the `match.index` of the next heading (the newline before it
	// is the last byte of this section's content), or `body.length` when no next heading exists.
	function sliceSection(heading: string): string {
		const entry = sections.find((s) => s.heading === heading)!;
		const entryIndex = sections.indexOf(entry);
		const nextEntry = sections[entryIndex + 1];
		const upperBound =
			nextEntry !== undefined ? nextEntry.startIndex - nextEntry.heading.length - 1 : body.length;
		return body.slice(entry.startIndex, upperBound);
	}

	const prose = sliceSection("## Prose").replace(/^\n/, "");
	const playbookHub = sliceSection("## Playbook hub");
	const researchHub = sliceSection("## Research hub");

	return { kind: "ok", prose, playbookHub, researchHub };
}

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
 * Used by `provisionBrain` to derive an MCP entry from a scaffolded template that
 * has not been written to disk yet.
 *
 * Returns the same `ParseBrainAideResult` union as `parseBrainAide`. The `"missing"`
 * variant is unreachable (the input is bytes, not a path): empty input returns
 * `{ kind: "malformed-frontmatter", reason: "frontmatter is required" }`.
 *
 * Validation order:
 * 1. Required frontmatter fields (`name`, `mcpServerConfig`, `mcpServerConfig.command`,
 *    `mcpServerConfig.args`) — a missing required field is surfaced before any deprecated-
 *    field error.
 * 2. Deprecated fields (`connector`, `rootPath`, `entryFile`, `tools`) — rejected with a
 *    reason listing every stale field found, in deprecated-set order.
 * 3. Body grammar — the closed-vocabulary walker (`extractBodySections`) checks that every
 *    `^## .+$` heading is one of the three required headings (`## Prose`, `## Playbook hub`,
 *    `## Research hub`) and that none are missing. An unknown heading is surfaced immediately
 *    (first occurrence); missing sections are all listed in one response so the user can fix
 *    them in a single edit.
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

	// Step 5: Extract the three required named body sections via the closed-vocabulary walker.
	// Unknown headings and missing required sections both surface as malformed-body.
	const bodyResult = extractBodySections(body);
	if (bodyResult.kind === "malformed-body") {
		return bodyResult;
	}

	const { prose, playbookHub, researchHub } = bodyResult;

	// Step 6: Return the ok result with all three body sections alongside the frontmatter config.
	return { kind: "ok", config, prose, playbookHub, researchHub };
}

/**
 * Reads `.aide/config/brain.aide` from the given host project root and parses it into a
 * tagged-result union. The brain.aide path is derived as `join(root, ".aide", "config", "brain.aide")`.
 *
 * Result branches:
 * - `"ok"` — file found, frontmatter parsed, all required fields valid, and all three body
 *   sections (`## Prose`, `## Playbook hub`, `## Research hub`) located. Each section is
 *   returned verbatim (byte-identical between heading boundary and next heading or EOF).
 * - `"missing"` — file does not exist or was unreachable (ENOENT or other I/O failure).
 *   Remediation is the same in both cases: run `/aide` and complete the brain wiring interview.
 * - `"malformed-frontmatter"` — file exists but YAML could not be parsed, or a required
 *   field is absent or wrong-typed, or a deprecated field (`connector`, `rootPath`,
 *   `entryFile`, `tools`) is present. `reason` names exactly which field is wrong.
 * - `"malformed-body"` — frontmatter is valid but the body fails the closed-vocabulary
 *   grammar: any of the three required sections is missing (reason lists every absent
 *   section in one response), or an unknown top-level heading is present (reason names
 *   the first unknown heading found).
 *
 * Load-bearing invariants:
 * - Never throws — all failure modes return a tagged result.
 * - Never interpolates any body section — `prose`, `playbookHub`, and `researchHub` are
 *   byte-identical to the file content between their heading boundaries. Call
 *   `interpolateArgs` separately when writing the MCP entry.
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
