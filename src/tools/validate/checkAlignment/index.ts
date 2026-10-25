import classifyAideFile from "@/tools/frontmatter/classifyAideFile/index.js";
import { GOVERNED_FIELDS } from "@/tools/frontmatter/governedFields/index.js";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import type { ValidationWarning } from "@/types/index.js";

/**
 * Warns when an intent spec records no alignment, or one that cannot be read:
 * a value outside the allowed list, or both `alignment` and the older `status`
 * name. An older spec's `status` counts as its alignment, so host projects that
 * have not moved to the new name stay quiet. Only intent specs are checked, by
 * the governed classifier rather than the tree-tag one, so plans, todo lists,
 * briefs, research, the session record and brain.aide never warn. An unparsable
 * frontmatter returns null because the `parse-error` warning already covers it.
 */
export default function checkAlignment({
	fileName,
	content,
	relativePath,
}: {
	fileName: string;
	content: string;
	relativePath: string;
}): ValidationWarning | null {
	if (classifyAideFile(fileName) !== "intent-spec") return null;

	const read = readGovernedValue({ content, kind: "intent-spec" });
	if (read.status === "unparsable") return null;

	if (read.ambiguous) {
		return {
			kind: "invalid-alignment",
			path: relativePath,
			message: "Both alignment and the older status name are set; keep only alignment",
		};
	}
	if (read.current.state === "not-set") {
		return {
			kind: "missing-alignment",
			path: relativePath,
			message: "Missing alignment field in frontmatter (a new spec starts at alignment: unreviewed)",
		};
	}
	if (read.current.state === "invalid") {
		const allowed = GOVERNED_FIELDS["intent-spec"].values.join(", ");
		return {
			kind: "invalid-alignment",
			path: relativePath,
			message: `alignment value "${read.current.raw}" is not one of ${allowed}`,
		};
	}
	return null;
}
