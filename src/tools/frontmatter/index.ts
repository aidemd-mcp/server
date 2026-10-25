import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import classifyAideFile from "./classifyAideFile/index.js";
import checkCompletion from "./checkCompletion/index.js";
import checkTransition from "./checkTransition/index.js";
import { GOVERNED_FIELDS } from "./governedFields/index.js";
import readGovernedValue from "./readGovernedValue/index.js";
import resolveTarget from "./resolveTarget/index.js";
import rewriteFieldLine from "./rewriteFieldLine/index.js";
import type {
	FrontmatterOutcome,
	FrontmatterRefusal,
	GovernedKind,
} from "./types/index.js";

export const FrontmatterInput = z.object({
	path: z
		.string()
		.min(1)
		.describe("The .aide file to read or change, relative to the project root"),
	field: z
		.string()
		.optional()
		.describe(
			"The governed field to change: alignment (intent specs) or status (plans, todo lists, briefs). Pass with value to change; omit both to read",
		),
	value: z
		.string()
		.optional()
		.describe("The new value for the field. Pass with field to change; omit both to read"),
});

/** Builds a refusal outcome so every exit reads the same. */
function refuse(path: string, refusal: FrontmatterRefusal): FrontmatterOutcome {
	return { kind: "refused", path, refusal };
}

/**
 * Reads or moves the one governed value (an intent spec's alignment, or a
 * plan's, todo list's or brief's status) in one AIDE file, and reports it. The
 * tool never chooses a value: callers (the aligner, QA, the user's approval, a
 * discard) decide, and the tool only enforces which moves are legal. Flow:
 * pairing, path resolution, file kind, read and parse, then either report the
 * value (read mode) or run the write checks (field, value, no-change, edit
 * site, transition, completion), rewrite the single line, verify by re-reading
 * and write. A refused call never writes; the tool never creates or deletes a
 * file and never touches any other frontmatter key.
 */
export default async function frontmatter(
	root: string,
	input: z.infer<typeof FrontmatterInput>,
): Promise<FrontmatterOutcome> {
	const { path, field, value } = input;

	// Pairing: field and value go together; one without the other is a mistake, not a read.
	if ((field === undefined) !== (value === undefined)) {
		return refuse(path, { kind: "pairing" });
	}

	// Resolve the path to a real regular file strictly inside the root, or refuse.
	const target = await resolveTarget({ root, path });
	if (target.kind === "refused") return refuse(path, target.refusal);
	const { abs, rel } = target;

	// Classify by basename: only governed kinds carry a value.
	const fileKind = classifyAideFile(rel);
	if (fileKind === "not-aide") return refuse(rel, { kind: "not-aide" });
	if (fileKind === "session" || fileKind === "research" || fileKind === "config") {
		return refuse(rel, { kind: "ungoverned", which: fileKind });
	}
	const kind: GovernedKind = fileKind;

	// Read the file and parse its governed value once; both modes start from this read.
	const content = await readFile(abs, "utf-8");
	const read = readGovernedValue({ content, kind });
	if (read.status === "unparsable") {
		return refuse(rel, { kind: "unparsable", detail: read.detail });
	}

	// Read mode: an ambiguous alignment is refused rather than guessed; otherwise report the value.
	if (field === undefined || value === undefined) {
		if (read.ambiguous) return refuse(rel, { kind: "ambiguous-alignment" });
		return {
			kind: "read",
			path: rel,
			field: read.field,
			current: read.current,
			legacy: read.legacy,
		};
	}

	// Write mode: the field must be one the tool governs at all.
	const governed = GOVERNED_FIELDS[kind];
	if (field !== "alignment" && field !== "status") {
		return refuse(rel, { kind: "unknown-field", field });
	}

	// The field must be the one this kind of file carries.
	if (field !== governed.field) {
		return refuse(rel, {
			kind: "wrong-field",
			fileKind: kind,
			field,
			expected: governed.field,
		});
	}

	// A file recording alignment under both names is refused, never repaired: picking a winner would be choosing a value.
	if (read.ambiguous) return refuse(rel, { kind: "ambiguous-alignment" });

	// The requested value must be in the kind's value set; this runs before transitions so a retired value like in-flight is named, not mistaken for an illegal move.
	const allowedValues: string[] = [...governed.values];
	if (!allowedValues.includes(value)) {
		return refuse(rel, {
			kind: "invalid-value",
			fileKind: kind,
			field: governed.field,
			value,
			allowed: allowedValues,
		});
	}

	// Same value under the current key is no change. A legacy spec holds it under the older name, so it still gets moved.
	if (!read.legacy && read.current.state === "set" && read.current.value === value) {
		return { kind: "unchanged", path: rel, field: governed.field, value };
	}

	// Without a single-line edit site there is nothing safe to rewrite.
	const { edit } = read;
	if (edit.kind === "none") {
		return refuse(rel, {
			kind: edit.reason === "no-frontmatter" ? "no-frontmatter" : "multi-line",
			field: governed.field,
		});
	}

	// Only legal moves pass; a final value (completed, abandoned) is reported as final. Re-recording a legacy spec's own value under the new key is a rename, not a value move, so it skips this check.
	const isLegacyRename = read.legacy && read.current.state === "set" && read.current.value === value;
	const transition = isLegacyRename ? { ok: true as const } : checkTransition({ kind, current: read.current, to: value });
	if (!transition.ok) {
		if (transition.final && read.current.state === "set") {
			return refuse(rel, {
				kind: "final",
				field: governed.field,
				value: read.current.value,
			});
		}
		return refuse(rel, {
			kind: "transition",
			field: governed.field,
			from: read.current,
			to: value,
			allowed: transition.allowed,
		});
	}

	// Completion is guarded: no open checkboxes, and a brief only after its plan.
	if (value === "completed") {
		const completionRefusal = await checkCompletion({ absPath: abs, content, kind });
		if (completionRefusal) return refuse(rel, completionRefusal);
	}

	// Rewrite exactly one line by offsets; every other byte stays as it was.
	const newContent = rewriteFieldLine({ content, edit, key: governed.field, value });

	// Read the new content back and refuse to write unless it reads exactly as requested under the current key name.
	const verify = readGovernedValue({ content: newContent, kind });
	const verified =
		verify.status === "ok" &&
		verify.current.state === "set" &&
		verify.current.value === value &&
		!verify.legacy &&
		!verify.ambiguous;
	if (!verified) {
		throw new Error(
			`aide_frontmatter: rewriting ${rel} would not read back as ${governed.field}: ${value}; nothing written`,
		);
	}

	// Verified: write the single changed file back.
	await writeFile(abs, newContent, "utf-8");
	return {
		kind: "changed",
		path: rel,
		field: governed.field,
		from: read.current,
		to: value,
		movedFromLegacy: read.legacy,
	};
}
