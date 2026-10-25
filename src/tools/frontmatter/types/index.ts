import type { GOVERNED_FIELDS } from "../governedFields/index.js";

/** File kinds that carry a governed frontmatter field: intent specs carry alignment; plans, todo lists and briefs carry status. */
export type GovernedKind = "intent-spec" | "plan" | "todo" | "brief";

/** Every kind `classifyAideFile` can return: the governed kinds plus the AIDE files that carry no governed field and non-AIDE names. */
export type AideFileKind =
	| GovernedKind
	| "research"
	| "session"
	| "config"
	| "not-aide";

/** The two frontmatter keys this tool governs. */
export type GovernedField = "alignment" | "status";

/** An intent spec's alignment value, derived from the one value list in GOVERNED_FIELDS. */
export type AlignmentValue =
	(typeof GOVERNED_FIELDS)["intent-spec"]["values"][number];

/** A plan, todo list or brief status value, derived from the one value list in GOVERNED_FIELDS (the three kinds share it). */
export type WorkStatus = (typeof GOVERNED_FIELDS)["plan"]["values"][number];

/** What a file's governed key holds right now: a value in the kind's set, a present key with any other value (raw text after the colon), or no key at all. */
export type CurrentValue =
	| { state: "set"; value: string }
	| { state: "invalid"; raw: string }
	| { state: "not-set" };

/**
 * Where a governed line can be changed in the original content. Offsets address the
 * original string: `replace` covers the target line's text (terminator excluded),
 * `insert` is a position for a new line plus the file's line terminator, `none`
 * means no single-line edit is possible and says why.
 */
export type EditSite =
	| { kind: "replace"; start: number; end: number }
	| { kind: "insert"; at: number; eol: "\n" | "\r\n" }
	| { kind: "none"; reason: "no-frontmatter" | "multi-line" };

/** Result of reading a file's governed value: unparsable frontmatter, or the field, current value, legacy and ambiguity flags and the edit site. */
export type GovernedRead =
	| { status: "unparsable"; detail: string }
	| {
			status: "ok";
			field: GovernedField;
			current: CurrentValue;
			legacy: boolean;
			ambiguous: boolean;
			edit: EditSite;
	  };

/** Every reason the tool refuses a call, discriminated on `kind`; each carries what its report line needs to name the cause. */
export type FrontmatterRefusal =
	| { kind: "pairing" }
	| { kind: "outside-root" }
	| { kind: "missing" }
	| { kind: "not-a-file" }
	| { kind: "not-aide" }
	| { kind: "ungoverned"; which: "session" | "research" | "config" }
	| { kind: "unparsable"; detail: string }
	| { kind: "no-frontmatter"; field: GovernedField }
	| { kind: "multi-line"; field: GovernedField }
	| { kind: "unknown-field"; field: string }
	| {
			kind: "wrong-field";
			fileKind: GovernedKind;
			field: string;
			expected: GovernedField;
	  }
	| { kind: "ambiguous-alignment" }
	| {
			kind: "invalid-value";
			fileKind: GovernedKind;
			field: GovernedField;
			value: string;
			allowed: string[];
	  }
	| {
			kind: "transition";
			field: GovernedField;
			from: CurrentValue;
			to: string;
			allowed: string[];
	  }
	| { kind: "final"; field: GovernedField; value: string }
	| { kind: "open-items"; items: { line: number; text: string }[] }
	| { kind: "plan-not-completed"; plan: string };

/** What `frontmatter(root, input)` returns: a read, a change, a no-change, or a refusal; each names the file. */
export type FrontmatterOutcome =
	| {
			kind: "read";
			path: string;
			field: GovernedField;
			current: CurrentValue;
			legacy: boolean;
	  }
	| {
			kind: "changed";
			path: string;
			field: GovernedField;
			from: CurrentValue;
			to: string;
			movedFromLegacy: boolean;
	  }
	| { kind: "unchanged"; path: string; field: GovernedField; value: string }
	| { kind: "refused"; path: string; refusal: FrontmatterRefusal };
