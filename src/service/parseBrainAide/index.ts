import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { BrainAideConfig, ParseBrainAideResult } from "@/types/index.js";

/**
 * The eight recognized marker tokens grouped as four pairs, in required order:
 * prose first, playbook second, studyPlaybook third, research fourth. Each pair
 * carries the exact lowercase byte sequences that delimit a named body section.
 * `as const` narrows `token` to the literal union
 * `"prose" | "playbook" | "studyPlaybook" | "research"` — these token strings
 * are also the destination field names on the ok result, so the user-facing
 * marker base name and the typed-object key are the same word (`study-playbook`
 * in markers, `studyPlaybook` in the typed result — kebab-to-camel
 * transformation is purely surface, not a code path).
 */
const MARKER_PAIRS = [
	{ token: "prose",        open: "<!-- aide-prose-start -->",         close: "<!-- aide-prose-end -->" },
	{ token: "playbook",     open: "<!-- aide-playbook-start -->",      close: "<!-- aide-playbook-end -->" },
	{ token: "studyPlaybook", open: "<!-- aide-study-playbook-start -->", close: "<!-- aide-study-playbook-end -->" },
	{ token: "research",     open: "<!-- aide-research-start -->",      close: "<!-- aide-research-end -->" },
] as const;

/**
 * Single closed-grammar walker over the body's marker pairs. Every marker-layout
 * violation class returns malformed-body naming the offending marker.
 *
 * Pipeline order (each step short-circuits to malformed-body on violation):
 * 1. Presence — all eight recognized markers must appear; lists every absent marker.
 * 2. Match — unmatched closers (closer before its opener) and unmatched openers
 *    (opener with no later closer) are each caught in document order.
 * 3. Order — the four openers must appear in prose-then-playbook-then-studyPlaybook-then-research order.
 * 4. Nesting — no recognized marker may appear inside another pair's opener-closer span.
 *    The four sections are siblings, never parent-child.
 * 5. Slice — bytes between each opener and its closer are returned verbatim.
 *
 * Bytes outside any marker pair are silently ignored by construction — the slicer
 * only reads the regions between matched opener/closer offsets.
 */
function extractMarkerSections(body: string):
	| { kind: "ok"; prose: string; playbook: string; studyPlaybook: string; research: string }
	| { kind: "malformed-body"; reason: string } {

	// --- Step 1: Locate every recognized marker in document order. ---
	// Build an ordered list of { tokenKind, sectionToken, index } entries by
	// scanning each of the eight exact byte sequences with indexOf.
	type MarkerEntry = {
		tokenKind: "open" | "close";
		sectionToken: "prose" | "playbook" | "studyPlaybook" | "research";
		marker: string;
		index: number;
	};

	const recognized: MarkerEntry[] = [];
	for (const { token, open, close } of MARKER_PAIRS) {
		let pos = 0;
		while (true) {
			const idx = body.indexOf(open, pos);
			if (idx === -1) break;
			recognized.push({ tokenKind: "open", sectionToken: token, marker: open, index: idx });
			pos = idx + 1;
		}
		pos = 0;
		while (true) {
			const idx = body.indexOf(close, pos);
			if (idx === -1) break;
			recognized.push({ tokenKind: "close", sectionToken: token, marker: close, index: idx });
			pos = idx + 1;
		}
	}
	recognized.sort((a, b) => a.index - b.index);

	// --- Malformed-marker detection ---
	// Scan for any HTML-comment-like span that LOOKS like an aide section marker
	// but is not one of the eight exact recognized sequences. Catches uppercase
	// variants, mixed-case, missing spaces, extra whitespace, typos, and
	// missing `aide-` prefix — the full set from the spec's "Bad examples" block.
	//
	// Boundary rule (per spec "Bytes outside any marker pair are silently
	// ignored"): only scan positions that are NOT inside a recognized matched
	// pair's content span. A user who writes `<!-- aide-misc -->` between two
	// recognized pairs is in a "bytes outside" region; that token is plain bytes,
	// not a malformed aide-section marker. To enforce this, we collect the spans
	// of any COMPLETE recognized pairs visible in the body (both opener and closer
	// present, opener before closer) and exclude those interior regions from the
	// scan. Incomplete pairs have no span to exclude, so the malformed marker in
	// their position (e.g. a typo'd opener replacing a recognized one) remains
	// in the scan region and is correctly caught.
	const RECOGNIZED_SET = new Set<string>(MARKER_PAIRS.flatMap(({ open, close }) => [open, close]));

	// Build exclusion spans from any complete recognized pairs present in the body.
	// A span is (innerStart, innerEnd) = (openIdx + open.length, closeIdx).
	const exclusionSpans: Array<{ start: number; end: number }> = [];
	for (const { open, close } of MARKER_PAIRS) {
		const openIdx = body.indexOf(open);
		const closeIdx = body.indexOf(close);
		if (openIdx !== -1 && closeIdx !== -1 && openIdx < closeIdx) {
			exclusionSpans.push({ start: openIdx + open.length, end: closeIdx });
		}
	}

	function isInsideExclusionSpan(idx: number): boolean {
		return exclusionSpans.some((s) => idx > s.start && idx < s.end);
	}

	// Two-pattern union to match malformed-but-recognizable section markers:
	//
	// Pattern A — aide-prefixed variants: tokens that contain "aide" AND at least
	// one of the section names (prose/playbook/study-playbook/research) or the
	// start/end keywords. This catches uppercase, mixed-case, extra-whitespace, and
	// typo variants like `<!-- AIDE-PROSE-START -->`, `<!-- aide-prose-strart -->`,
	// `<!-- AIDE-STUDY-PLAYBOOK-START -->`, and `<!-- aide-playboook-end -->` (has
	// "aide" + "end"), while NOT flagging a legitimate `<!-- aide-misc -->` comment
	// (has "aide" but no section/start/end).
	//
	// Pattern B — section-name-only variants: tokens that start (after whitespace)
	// with one of the four section names AND contain a start/end keyword. This
	// catches the "missing aide- prefix" class, e.g. `<!-- prose-start -->`,
	// while NOT flagging generic comments like `<!-- TODO: research this -->` (has
	// "research" but no "start"/"end") or `<!-- aide-misc -->` (no section name).
	const candidateRegexA = /<!--[^>]*aide[^>]*(?:prose|playbook|study-playbook|research|start|end)[^>]*-->/gi;
	const candidateRegexB = /<!--\s*(?:prose|playbook|study-playbook|research)[^>]*(?:start|end)[^>]*-->/gi;
	let candidateMatch: RegExpExecArray | null;
	let firstMalformed: { marker: string; index: number } | null = null;

	for (const regex of [candidateRegexA, candidateRegexB]) {
		regex.lastIndex = 0;
		while ((candidateMatch = regex.exec(body)) !== null) {
			const candidate = candidateMatch[0];
			if (RECOGNIZED_SET.has(candidate)) continue; // exact recognized token — not malformed
			if (isInsideExclusionSpan(candidateMatch.index)) continue; // inside a pair's content span — plain bytes
			if (firstMalformed === null || candidateMatch.index < firstMalformed.index) {
				firstMalformed = { marker: candidate, index: candidateMatch.index };
			}
		}
	}
	if (firstMalformed !== null) {
		return { kind: "malformed-body", reason: `unknown marker: ${firstMalformed.marker}` };
	}

	// --- Step 1 cont: Presence / partial-pair check ---
	// Categorize each section pair: both absent, only opener present, only closer
	// present, or both present. Pairs where BOTH markers are absent are collected
	// for a single bulk "missing markers" reason (so the user fixes them all in
	// one edit). Pairs where only ONE marker is present get the unmatched reason
	// immediately (before the bulk-absent check), because naming the specific
	// present marker is more actionable than listing it as generically missing.
	const presentMarkers = new Set(recognized.map((e) => e.marker));

	// Fire unmatched-opener (opener present, closer absent) or unmatched-closer
	// (closer present, opener absent) for each partially-present pair, in
	// prose-then-playbook-then-studyPlaybook-then-research order (first partially-broken pair wins).
	for (const { token, open, close } of MARKER_PAIRS) {
		const hasOpen = presentMarkers.has(open);
		const hasClose = presentMarkers.has(close);
		if (hasOpen && !hasClose) {
			return {
				kind: "malformed-body",
				reason: `unmatched opening marker: ${open} has no matching ${close}`,
			};
		}
		if (!hasOpen && hasClose) {
			return {
				kind: "malformed-body",
				reason: `unmatched closing marker: ${close} appeared without a prior ${open}`,
			};
		}
	}

	// After partial-pair check: list every completely-absent pair.
	const absentMarkers: string[] = [];
	for (const { open, close } of MARKER_PAIRS) {
		if (!presentMarkers.has(open)) absentMarkers.push(open);
		if (!presentMarkers.has(close)) absentMarkers.push(close);
	}
	if (absentMarkers.length > 0) {
		return { kind: "malformed-body", reason: `missing markers: ${absentMarkers.join(", ")}` };
	}

	// --- Step 2: Unmatched-closer check (wrong document order) ---
	// All eight markers are present. Walk in document order. If a close marker
	// for a section appears before its matching open marker has been seen, the
	// closer arrived in the wrong position in the document.
	const seenOpeners = new Set<string>();
	for (const entry of recognized) {
		if (entry.tokenKind === "open") {
			seenOpeners.add(entry.sectionToken);
		} else {
			if (!seenOpeners.has(entry.sectionToken)) {
				const matchingOpen = MARKER_PAIRS.find((p) => p.token === entry.sectionToken)!.open;
				return {
					kind: "malformed-body",
					reason: `unmatched closing marker: ${entry.marker} appeared without a prior ${matchingOpen}`,
				};
			}
		}
	}

	// --- Step 3: Section-order check ---
	// The four openers must appear in prose-then-playbook-then-studyPlaybook-then-research order.
	// Fires only after presence and matching pass (missing-markers reason would
	// have fired earlier if any pair was absent).
	const openerOrder = recognized.filter((e) => e.tokenKind === "open");
	const expectedTokenOrder = MARKER_PAIRS.map((p) => p.token);
	for (let i = 0; i < openerOrder.length - 1; i++) {
		const currentToken = openerOrder[i].sectionToken;
		const nextToken = openerOrder[i + 1].sectionToken;
		const currentExpectedIdx = expectedTokenOrder.indexOf(currentToken);
		const nextExpectedIdx = expectedTokenOrder.indexOf(nextToken);
		if (currentExpectedIdx > nextExpectedIdx) {
			// currentToken appeared first in document order but has a later required position
			// than nextToken — currentToken is the out-of-order opener that appeared before
			// the earlier-required nextToken.
			const outOfOrderPair = MARKER_PAIRS.find((p) => p.token === currentToken)!;
			const expectedPriorPair = MARKER_PAIRS.find((p) => p.token === nextToken)!;
			return {
				kind: "malformed-body",
				reason: `marker order violation: ${outOfOrderPair.open} appeared before ${expectedPriorPair.open}`,
			};
		}
	}

	// --- Step 4: Nesting check ---
	// For each matched pair, check that no other recognized marker (open or close)
	// appears at a byte offset strictly inside that pair's span. The four sections
	// are siblings, never parent-child. Only markers that are part of a recognized
	// matched pair are considered here — bytes-outside-pairs content is out of scope.
	const pairSpans = MARKER_PAIRS.map(({ token, open, close }) => {
		const openEntry = recognized.find((e) => e.tokenKind === "open" && e.sectionToken === token)!;
		const closeEntry = recognized.find((e) => e.tokenKind === "close" && e.sectionToken === token)!;
		return { token, open, innerStart: openEntry.index + open.length, innerEnd: closeEntry.index };
	});

	for (const span of pairSpans) {
		for (const entry of recognized) {
			if (entry.sectionToken === span.token) continue; // same section, skip
			if (entry.index > span.innerStart && entry.index < span.innerEnd) {
				return {
					kind: "malformed-body",
					reason: `nested marker: ${entry.marker} appeared inside the ${span.token} section`,
				};
			}
		}
	}

	// --- Step 5: Section slicing ---
	// Slice each section as the bytes strictly between opener.index+opener.length
	// and closer.index. No trimming, no normalization — verbatim bytes only.
	const result: Record<string, string> = {};
	for (const span of pairSpans) {
		result[span.token] = body.slice(span.innerStart, span.innerEnd);
	}

	return {
		kind: "ok",
		prose: result["prose"]!,
		playbook: result["playbook"]!,
		studyPlaybook: result["studyPlaybook"]!,
		research: result["research"]!,
	};
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
 * 3. Body grammar — the closed-vocabulary marker walker (`extractMarkerSections`) checks
 *    that every required marker pair is present and well-formed; every marker-layout
 *    violation class returns `malformed-body` naming the offending marker.
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

	// Step 5: Extract the four required named body sections via the closed-vocabulary marker walker.
	// The walker enforces the paired HTML-comment marker grammar — required pair presence,
	// no malformed/typo'd tokens, no unmatched closers or openers, correct section order
	// (prose then playbook then studyPlaybook then research), and no nesting. Every violation class returns
	// malformed-body naming the offending marker.
	const bodyResult = extractMarkerSections(body);
	if (bodyResult.kind === "malformed-body") {
		return bodyResult;
	}

	const { prose, playbook, studyPlaybook, research } = bodyResult;

	// Step 6: Return the ok result with all four body sections alongside the frontmatter config.
	return { kind: "ok", config, prose, playbook, studyPlaybook, research };
}

/**
 * Reads `.aide/config/brain.aide` from the given host project root and parses it into a
 * tagged-result union. The brain.aide path is derived as `join(root, ".aide", "config", "brain.aide")`.
 *
 * Result branches:
 * - `"ok"` — file found, frontmatter parsed, all required fields valid, and all four body
 *   sections located via their paired HTML-comment markers
 *   (`<!-- aide-prose-start -->` / `<!-- aide-prose-end -->`,
 *   `<!-- aide-playbook-start -->` / `<!-- aide-playbook-end -->`,
 *   `<!-- aide-study-playbook-start -->` / `<!-- aide-study-playbook-end -->`,
 *   `<!-- aide-research-start -->` / `<!-- aide-research-end -->`).
 *   Each section is returned verbatim — byte-identical between its opening marker and its
 *   matching closing marker.
 * - `"missing"` — file does not exist or was unreachable (ENOENT or other I/O failure).
 *   Remediation is the same in both cases: run `/aide` and complete the brain wiring interview.
 * - `"malformed-frontmatter"` — file exists but YAML could not be parsed, or a required
 *   field is absent or wrong-typed, or a deprecated field (`connector`, `rootPath`,
 *   `entryFile`, `tools`) is present. `reason` names exactly which field is wrong.
 * - `"malformed-body"` — frontmatter is valid but the body fails the closed marker-pair
 *   grammar. Violation classes: required pair missing (reason lists every absent marker),
 *   malformed or typo'd marker token (reason names the first offending marker), unmatched
 *   closing marker, unmatched opening marker, wrong section order, or nested markers.
 *   `reason` names the violating marker. The `studyPlaybook` section participates in the
 *   same closed grammar as a sibling of the other three sections (never a parent or child).
 *
 * Load-bearing invariants:
 * - Never throws — all failure modes return a tagged result.
 * - Never interpolates any body section — `prose`, `playbook`, `studyPlaybook`, and `research` are
 *   byte-identical to the file content between their marker boundaries. Call
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
