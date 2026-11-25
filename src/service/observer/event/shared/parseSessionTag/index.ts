import protocol from "@/service/observer/event/shared/protocol/index.js";
import isSessionId, { SESSION_ID_PATTERN } from "@/util/runtimePaths/shared/isSessionId/index.js";

/** The session-id pattern without its anchors, so it can sit inside a larger one. */
const ID_CLASS = SESSION_ID_PATTERN.source.slice(1, -1);

const TAG = new RegExp(`\\[${protocol.sessionTagLabel} (${ID_CLASS})\\]`);

/**
 * Finds the first `[observer-session <id>]` in any text (a plain reply, a
 * JSON-stringified MCP content array, escaped JSON text) and returns the id
 * only when `isSessionId` accepts it; null when the text carries no tag or its
 * id is not a safe session id (brief commitments #71, #90). Pure, no `node:`
 * import.
 */
export default function parseSessionTag(text: string): string | null {
	const id = TAG.exec(text)?.[1];
	if (id === undefined || !isSessionId(id)) return null;
	return id;
}
