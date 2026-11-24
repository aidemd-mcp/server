import { useEffect, useRef, useState } from "react";
import type { DrawerItem, PageRoute, SessionRoute, SessionTab } from "@/observer/page/types/index.js";
import buildHref from "@/observer/page/route/buildHref/index.js";
import parseRoute from "@/observer/page/route/parseRoute/index.js";

/** The slice of `window.location` the route is read from. */
type RouteLocation = { pathname: string; search: string };

/** The slice of `window.history` a route change writes to. */
type RouteHistory = { pushState(data: unknown, unused: string, url: string): void };

/** The slice of `window` that reports Back and Forward. */
type RouteEvents = {
	addEventListener(name: "popstate", listener: () => void): void;
	removeEventListener(name: "popstate", listener: () => void): void;
};

/**
 * Holds the address bar's route and moves it: `setTab`, `openItem` and `closeItem` push a history
 * entry through `buildHref` and update the route, and Back or Forward re-reads `location`. Only a
 * session route can change tab or detail; on Home or an invalid link the three do nothing. Each
 * browser slice defaults to the real one when its turn comes, never at render, so a server render
 * with only `location` passed never touches `window`.
 */
export default function useRoute({
	location,
	history,
	events,
}: {
	location?: RouteLocation;
	history?: RouteHistory;
	events?: RouteEvents;
} = {}): {
	route: PageRoute;
	setTab(tab: SessionTab): void;
	openItem(item: DrawerItem): void;
	closeItem(): void;
} {
	const [route, setRoute] = useState<PageRoute>(() => parseRoute(location ?? window.location));
	// A ref so two changes in one event handler each build on the one before, not on the render's route.
	const current = useRef(route);

	useEffect(() => {
		const target = events ?? window;
		const onPopState = () => {
			current.current = parseRoute(location ?? window.location);
			setRoute(current.current);
		};
		target.addEventListener("popstate", onPopState);
		return () => target.removeEventListener("popstate", onPopState);
		// `location` and `events` are fixed for the page's life; the listener reads them when it fires.
	}, []);

	function go(next: SessionRoute): void {
		(history ?? window.history).pushState(null, "", buildHref(next));
		current.current = next;
		setRoute(next);
	}

	return {
		route,
		setTab: (tab) => {
			if (current.current.kind === "session") go({ ...current.current, tab });
		},
		openItem: (item) => {
			if (current.current.kind === "session") go({ ...current.current, item });
		},
		closeItem: () => {
			if (current.current.kind === "session") go({ ...current.current, item: null });
		},
	};
}
