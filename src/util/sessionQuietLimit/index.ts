/**
 * How long a session may go without an event before it reads as "quiet, maybe
 * stuck". It only marks a session; it never ends one. `event`'s `judgeLiveness`
 * and the observer page both read this one value so the delete refusal and the
 * page can never disagree. Pure number with no import, so the page bundle may
 * import it.
 */
const SESSION_QUIET_LIMIT_MS = 15 * 60 * 1000;

export default SESSION_QUIET_LIMIT_MS;
