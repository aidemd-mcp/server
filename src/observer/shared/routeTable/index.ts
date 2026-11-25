import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * The one list of the observer's routes: each route's handler name, method, path pattern
 * (`:param` segments), purpose, whether it reads held state (so waits for the replay) and whether it
 * needs the observer's token. `tokenAccess` is `required` for every data route, `open` for the page
 * shell and the allowlisted assets (they hold no project data, so a bad or expired link can still
 * reach the page's invalid-link screen), and `open-for-html` for `GET /`, which is open only when
 * Accept lists text/html (the JSON probe keeps the token). Host and Origin checks apply to every
 * route whatever its `tokenAccess`. The request matcher pairs each row with its handler, and the
 * index answer lists the same rows, so the routes served and the routes listed cannot drift apart.
 */
const routeTable = [
	{ name: "getIndex", method: "GET", path: "/", purpose: "Route list; answers while history is still loading.", readRoute: false, tokenAccess: "open-for-html" },
	{ name: "getSessionPage", method: "GET", path: protocol.sessionRoute, purpose: "A session's page (HTML).", readRoute: false, tokenAccess: "open" },
	{ name: "getAsset", method: "GET", path: "/assets/:name", purpose: "The page's bundled script and stylesheet.", readRoute: false, tokenAccess: "open" },
	{ name: "listProjects", method: "GET", path: "/api/projects", purpose: "Every project with its root, sessions and latest event time.", readRoute: true, tokenAccess: "required" },
	{ name: "getStatus", method: "GET", path: "/api/projects/:project/status", purpose: "The project's view: rebuilt status, or no-project-root.", readRoute: true, tokenAccess: "required" },
	{ name: "getEvents", method: "GET", path: "/api/projects/:project/events", purpose: "The project's sessions with their events (?session=<id> for one).", readRoute: true, tokenAccess: "required" },
	{ name: "getFile", method: "GET", path: "/api/projects/:project/file", purpose: "One text file inside the project's reported root (?path=<p>).", readRoute: true, tokenAccess: "required" },
	{ name: "getTask", method: "GET", path: "/api/projects/:project/task/:slug", purpose: "One kanban task's note and parsed fields.", readRoute: true, tokenAccess: "required" },
	{ name: "listSessions", method: "GET", path: "/api/projects/:project/sessions", purpose: "The project's sessions with liveness and event count.", readRoute: true, tokenAccess: "required" },
	{ name: "archiveSession", method: "POST", path: "/api/projects/:project/sessions/:id/archive", purpose: "Archive one past session: move its recording into the project's archive.", readRoute: true, tokenAccess: "required" },
	{ name: "listArchived", method: "GET", path: "/api/projects/:project/archive", purpose: "The project's archived sessions.", readRoute: true, tokenAccess: "required" },
	{ name: "restoreSession", method: "POST", path: "/api/projects/:project/archive/:id/restore", purpose: "Restore one archived session to the project's history.", readRoute: true, tokenAccess: "required" },
	{ name: "deleteSession", method: "DELETE", path: "/api/projects/:project/archive/:id", purpose: "Permanently delete one archived session's recording.", readRoute: true, tokenAccess: "required" },
	{ name: "postEvent", method: "POST", path: protocol.eventsRoute, purpose: "Accept one event from a recorder.", readRoute: false, tokenAccess: "required" },
	{ name: "postShutdown", method: "POST", path: protocol.shutdownRoute, purpose: "Ask this observer to stop for a newer one; local tools only.", readRoute: false, tokenAccess: "required" },
	{ name: "streamUpdates", method: "GET", path: "/api/stream", purpose: "Server-sent events: snapshot, then each event and status as it lands (?project=<project> for one project).", readRoute: true, tokenAccess: "required" },
] as const;

export default routeTable;
