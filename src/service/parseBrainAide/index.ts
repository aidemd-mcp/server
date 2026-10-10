import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { BrainAideConfig, ParseBrainAideResult } from "@/types/index.js";
import extractMarkerSections from "./extractMarkerSections/index.js";

/** Human wording for the common read-failure codes; any other code falls back to the error's own message. */
const READ_ERROR_LABELS: Record<string, string> = {
	EACCES: "permission denied",
	EPERM: "operation not permitted",
	EISDIR: "path is a directory",
};

/**
 * Returns a copy of `config.mcpServerConfig.args` with every `${fieldName}` placeholder
 * substituted against the top-level frontmatter fields. `${name}` is the only field the
 * current schema resolves; unknown keys (any `${something-not-in-the-map}`) pass through
 * verbatim.
 *
 * The helper walks args element-by-element:
 * - String elements: `${fieldName}` placeholder substitution is applied. Unknown keys pass
 *   through verbatim (the `${...}` token is left as-is in the output).
 * - Null elements: passed through unchanged at their original index — there is no string to
 *   substitute into. Null is the explicit unwired-slot signal; coercing it here would silently
 *   break sync's null-refusal downstream.
 *
 * The return type is `(string | null)[]`. Array length is always equal to the input length —
 * null entries do NOT compact away. The element at each index in the output corresponds to
 * the element at the same index in the input.
 *
 * The default scaffold contains no `${...}` placeholders and may carry one or more nulls at
 * unwired-slot indexes. For that scaffold this helper is structurally a no-op — output
 * deep-equals input. Advanced users can embed `${name}` in string args to inject the brain's
 * name at install time (e.g. `["some-launcher", "--profile", "${name}", null]`); null entries
 * at adjacent indexes continue to pass through unchanged.
 *
 * Audience: install-time callers only — this is the `.mcp.json`-writer surface, never the
 * agent-facing surface. Consumers running `interpolateArgs` and then sync handle null-refusal
 * in sync, never in this helper. It is the ONLY substitution surface in the package: no other
 * function in the codebase replaces placeholders in brain.aide content. The prose body is
 * never passed through here and must never be interpolated.
 */
export function interpolateArgs(config: BrainAideConfig): (string | null)[] {
	const substitutions: Record<string, string> = {
		name: config.name,
	};

	return config.mcpServerConfig.args.map((arg) => {
		if (arg === null) return null;
		return arg.replace(/\$\{(\w+)\}/g, (match, key: string) => {
			return Object.prototype.hasOwnProperty.call(substitutions, key) ? substitutions[key] : match;
		});
	});
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
 *    Step 4 — args validation: `mcpServerConfig.args` must be an array whose every element
 *    is a string OR null. Null at any index is the explicit unwired-slot signal — it is part
 *    of the args contract, NOT a malformed value. Any element of any other type (number,
 *    boolean, object, undefined) returns `malformed-frontmatter` with a reason naming the
 *    field and the accepted set (strings and null).
 * 2. Step 4b — Deprecated fields (`connector`, `rootPath`, `entryFile`, `tools`) — rejected
 *    with a reason listing every stale field found, in deprecated-set order.
 * 3. Body grammar — the contract-driven marker walker (`extractMarkerSections`) reads the
 *    required sections from the published brain contract, so any backend's hand-written
 *    config that satisfies the contract parses. Structural faults among the sections that
 *    are present (unknown or typo'd marker token, half-present pair, wrong section order,
 *    nesting) return `malformed-body` naming the violating marker, and are always reported
 *    before absence. Wholly absent sections return `missing-sections`, naming each one in
 *    contract order; they are never defaulted or filled in. The result also carries the
 *    validated frontmatter (`name`, `mcpServerConfig`) and `present`, the verbatim bytes of
 *    every section that is there, so migration detection can judge an old-shape config
 *    without a second reader.
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

	if (!Array.isArray(mcpServerConfig["args"]) || !mcpServerConfig["args"].every((a) => typeof a === "string" || a === null)) {
		return { kind: "malformed-frontmatter", reason: "mcpServerConfig.args is required and must be an array of strings or null" };
	}

	// Step 4b: Reject deprecated fields. Runs AFTER required-field validation so a user
	// missing a required field sees that error first. Deprecated fields are listed in
	// fixed set order (not user-file order) for deterministic output.
	const DEPRECATED_FIELDS = ["connector", "rootPath", "entryFile", "tools"] as const;
	const foundDeprecated = DEPRECATED_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(fm, key));
	if (foundDeprecated.length > 0) {
		return { kind: "malformed-frontmatter", reason: `deprecated fields: ${foundDeprecated.join(", ")}` };
	}

	// Step 4c: Construct the validated frontmatter — exactly the two top-level fields.
	// Named `parsedFrontmatter` (not `config`) to avoid collision with the body-section
	// field also named `config` on the flattened ok result.
	const parsedFrontmatter: BrainAideConfig = {
		name: fm["name"],
		mcpServerConfig: {
			command: mcpServerConfig["command"],
			args: mcpServerConfig["args"] as (string | null)[],
		},
	};

	// Step 5: Extract the contract's required body sections via the contract-driven marker walker.
	const extraction = extractMarkerSections(body);
	if (extraction.kind === "malformed-body") return extraction;
	if (extraction.kind === "missing-sections") {
		return {
			kind: "missing-sections",
			sections: extraction.sections,
			name: parsedFrontmatter.name,
			mcpServerConfig: parsedFrontmatter.mcpServerConfig,
			present: extraction.present,
		};
	}

	// Step 6: Return the ok result with flattened frontmatter and every body section.
	const { kind: _kind, ...sections } = extraction;
	return {
		kind: "ok",
		name: parsedFrontmatter.name,
		mcpServerConfig: parsedFrontmatter.mcpServerConfig,
		...sections,
	};
}

/**
 * Reads `.aide/config/brain.aide` from the given host project root and parses it into a
 * tagged-result union. The brain.aide path is derived as `join(root, ".aide", "config", "brain.aide")`.
 *
 * Result branches:
 * - `"ok"` — file found, frontmatter parsed, all required fields valid, and every section
 *   of the published brain contract located via its paired HTML-comment markers. Each
 *   section is returned verbatim — byte-identical between its opening marker and its
 *   matching closing marker — as its own field.
 * - `"missing"` — file does not exist (ENOENT only). Remediation: run `/aide` and
 *   complete the brain wiring interview.
 * - `"unreadable"` — file exists but could not be read (EACCES, EISDIR, any non-ENOENT
 *   I/O failure). `reason` reads `cannot read .aide/config/brain.aide: <cause> (<code>)`.
 * - `"malformed-frontmatter"` — file exists but YAML could not be parsed, or a required
 *   field is absent or wrong-typed, or a deprecated field (`connector`, `rootPath`,
 *   `entryFile`, `tools`) is present. `reason` names exactly which field is wrong.
 * - `"malformed-body"` — frontmatter is valid but the sections that are present fail the
 *   marker-pair grammar. Violation classes: malformed or typo'd marker token (reason names
 *   the first offending marker), unmatched closing marker, unmatched opening marker, wrong
 *   section order, or nested markers. `reason` names the violating marker. Structural
 *   faults are always reported before absence.
 * - `"missing-sections"` — frontmatter is valid and every present pair is structurally
 *   sound, but one or more whole required sections are absent. `sections` names each absent
 *   section in contract order. `name` and `mcpServerConfig` carry the validated frontmatter
 *   and `present` holds the verbatim bytes of every section that is there (absent sections
 *   have no key). The reader never defaults or fills in a missing section; repair is by
 *   insertion through the brain configuration command.
 *
 * Load-bearing invariants:
 * - Never throws — all failure modes return a tagged result.
 * - Never interpolates any body section — each section field is byte-identical to the file
 *   content between its marker boundaries. Call `interpolateArgs` separately when writing
 *   the MCP entry.
 * - Never branches on `name` — the field is surfaced unchanged for consumers to use.
 * - `mcpServerConfig.args` is typed `(string | null)[]` — null entries are preserved verbatim
 *   at their original indexes. Null at any index is the explicit unwired-slot signal; there is
 *   no literal-string sentinel recognized at any layer of the package.
 */
export default async function parseBrainAide(root: string): Promise<ParseBrainAideResult> {
	// Step 1: Read the file. Only ENOENT means the file is absent. Any other I/O failure
	// (EACCES, EISDIR, ...) means the file is present but unreadable, so it is reported as
	// `unreadable` with the read error named — a present file is never reported as absent.
	const brainAidePath = join(root, ".aide", "config", "brain.aide");

	let content: string;
	try {
		content = await readFile(brainAidePath, "utf-8");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return { kind: "missing" };
		const cause = code ? `${READ_ERROR_LABELS[code] ?? (err as Error).message} (${code})` : String(err);
		return { kind: "unreadable", reason: `cannot read .aide/config/brain.aide: ${cause}` };
	}

	// Delegate to the string parser for steps 2–6.
	return parseBrainAideFromString(content);
}
