/**
 * The observer's whole wire contract: the route events are posted to, the
 * header that carries the observer's token, the marker `GET /` answers with
 * (the `observer` value the single-instance probe checks), the only address
 * the observer listens on (also the host of `observer.json`'s `address`), the
 * shutdown route a newer caller uses to replace an older observer, the header
 * that carries the recording project's key on each post, the session view's path
 * pattern and the query parameter that carries the token on a link, and the
 * list of ports it may bind (tried in order) with the environment variable that
 * overrides the preferred one, the route hooks post presence pings to, and the
 * label of the session tag every event reply ends with.
 * The recorder, `src/observer` (post route, index route, shutdown route, probe,
 * bind, start), the start tool and the view command all import this object, so
 * sender, receiver and probe can never disagree (brief commitments #17, #33,
 * #41, #43, #90, #98).
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
	ports: [24680, 24681, 24682, 24683, 24684, 24685, 24686, 24687, 24688, 24689],
	presenceRoute: "/api/presence",
	sessionTagLabel: "observer-session",
	portEnvVar: "AIDE_OBSERVER_PORT",
} as const;
