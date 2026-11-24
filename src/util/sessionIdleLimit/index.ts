/**
 * How long after its last event a session still counts as active even when the
 * process that wrote it is gone. The one value both `event`'s `judgeLiveness`
 * (live / not live) and `status`'s `foldSessions` (live / idle / ended) use, so
 * the delete refusal and the page can never disagree. It holds only the number;
 * how each caller applies it stays with the caller.
 */
const SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000;

export default SESSION_IDLE_LIMIT_MS;
