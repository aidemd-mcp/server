/** The one session-id pattern: one safe file-name segment, at most 128 characters. */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * True when `sessionId` is one safe file-name segment: no separators, no `..`,
 * no leading dot, at most 128 characters. The one session-id rule shared by
 * every helper that turns a session id into a log path.
 */
export default function isSessionId(sessionId: string): boolean {
	return SESSION_ID_PATTERN.test(sessionId);
}
