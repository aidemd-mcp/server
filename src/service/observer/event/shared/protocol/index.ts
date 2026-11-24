/**
 * The observer's whole wire contract: the route events are posted to, the
 * header that carries the observer's token, the marker `GET /` answers with
 * (the `observer` value the single-instance probe checks), the only address
 * the observer listens on (also the host of `observer.json`'s `address`), the
 * shutdown route a newer caller uses to replace an older observer, the header
 * that carries the recording project's key on each post, the session view's path
 * pattern and the query parameter that carries the token on a link, and the
 * default port with the environment variable that overrides it.
 * The recorder, `src/observer` (post route, index route, shutdown route, probe,
 * bind, start), the start tool and the view command all import this object, so
 * sender, receiver and probe can never disagree (brief commitments #17, #33,
 * #41, #43).
 */
export default {
	eventsRoute: "/api/events",
	shutdownRoute: "/api/shutdown",
	tokenHeader: "x-aide-observer-token",
	projectHeader: "x-aide-observer-project",
	tokenQuery: "token",
	sessionRoute: "/p/:project/s/:session",
	indexMarker: "aide-observer",
	bindHost: "127.0.0.1",
	defaultPort: 24680,
	portEnvVar: "AIDE_OBSERVER_PORT",
} as const;
