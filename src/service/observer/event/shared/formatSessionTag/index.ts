import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * Builds the session tag every event reply ends with: `[observer-session <id>]`.
 * The hook finds the tag in the reply text with `parseSessionTag` and links its
 * Claude session to the observer session; both read the label from `protocol`,
 * so the tool that writes the tag and the hook that reads it cannot drift
 * (brief commitments #71, #90). Pure, no `node:` import.
 */
export default function formatSessionTag(sessionId: string): string {
	return `[${protocol.sessionTagLabel} ${sessionId}]`;
}
