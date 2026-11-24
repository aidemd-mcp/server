import type { TreeFileKind } from "../../types/index.js";

/** The one path whose `session.aide` is the project's session record. */
const SESSION_RECORD_PATH = ".aide/session.aide";

/**
 * The kind of an AIDE file in the tree, by its project-relative path. Never null:
 * every AIDE file gets a kind so none can be left out of the tree. Scan's own
 * `type` is not used because it tags `brief.aide` and `session.aide` as intent.
 * Pure.
 */
export default function classifyTreeFile(relativeFilePath: string): TreeFileKind {
	const posix = relativeFilePath.replace(/\\/g, "/");
	if (posix === SESSION_RECORD_PATH) return "session";

	const basename = posix.slice(posix.lastIndexOf("/") + 1);
	if (basename === ".aide" || basename === "intent.aide") return "intent";
	if (basename === "research.aide") return "research";
	if (basename === "brief.aide") return "brief";
	if (basename === "plan.aide") return "plan";
	if (basename === "todo.aide") return "todo";
	return "other";
}
