import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { PageRoute, SessionTab } from "@/observer/page/types/index.js";
import parseItem from "@/observer/page/route/parseItem/index.js";

/** The protocol's session path split into its segments, e.g. `["p", ":project", "s", ":session"]`. */
const SESSION_PATTERN = protocol.sessionRoute.split("/").slice(1);
const PROJECT_AT = SESSION_PATTERN.indexOf(":project");
const SESSION_AT = SESSION_PATTERN.indexOf(":session");

/** Every tab a link may name; typed as a record so a new `SessionTab` cannot be left out. */
const TABS: Record<SessionTab, true> = { tree: true, plans: true, board: true, record: true, sessions: true, history: true };

/**
 * Turns the address bar into a route: Home at `/`, a session view at `/p/<key>/s/<id>` (one
 * trailing slash allowed) with its tab from `?tab=` (unknown or absent is `tree`) and its detail
 * from `?item=`. Without a `token` query value, or at any other address, the route is `invalid`,
 * since no request could be made.
 */
export default function parseRoute({ pathname, search }: { pathname: string; search: string }): PageRoute {
	const query = new URLSearchParams(search);
	const token = query.get(protocol.tokenQuery);
	if (!token) return { kind: "invalid" };

	if (pathname === "/") return { kind: "home", token };

	const segments = pathname.replace(/\/$/, "").split("/").slice(1);
	const matches = segments.length === SESSION_PATTERN.length && SESSION_PATTERN.every((part, at) => part.startsWith(":") || part === segments[at]);
	if (!matches) return { kind: "invalid" };

	try {
		const projectKey = decodeURIComponent(segments[PROJECT_AT]);
		const sessionId = decodeURIComponent(segments[SESSION_AT]);
		if (!projectKey || !sessionId) return { kind: "invalid" };

		const tabValue = query.get("tab") ?? "";
		const tab: SessionTab = Object.hasOwn(TABS, tabValue) ? (tabValue as SessionTab) : "tree";
		return { kind: "session", token, projectKey, sessionId, tab, item: parseItem(query.get("item")) };
	} catch {
		return { kind: "invalid" };
	}
}
