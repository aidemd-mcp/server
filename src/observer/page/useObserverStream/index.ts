import { useEffect, useReducer } from "react";
import connectStream from "@/observer/page/api/connectStream/index.js";
import reduceStream from "@/observer/page/reduceStream/index.js";
import type { StreamState } from "@/observer/page/types/index.js";
import loadProjects from "./loadProjects/index.js";
import loadSessions from "./loadSessions/index.js";

const INITIAL: StreamState = { connection: "connecting", held: [], views: {}, listings: {}, projects: null };

/**
 * Everything the page holds from the observer. Opens the live stream (one project's, or every
 * project's on Home) and folds its frames and connection changes through `reduceStream`; the stream
 * reconnects on its own and a reconnect snapshot replaces the held events. Home also loads the
 * project list and each project's status once, so it has something to show before any event.
 * A project whose view has no root is never given a status, so its session list is fetched
 * on each of its status frames (the stream sends no list frame for new events).
 */
export default function useObserverStream({ token, projectKey }: { token: string; projectKey?: string }): StreamState {
	const [state, dispatch] = useReducer(reduceStream, INITIAL);

	useEffect(() => {
		const stream = connectStream({
			token,
			projectKey,
			onFrame: dispatch,
			onConnection: (connection) => dispatch({ name: "connection", state: connection }),
		});
		return () => stream.close();
	}, [token, projectKey]);

	useEffect(() => {
		if (projectKey !== undefined) return;
		let cancelled = false;
		void loadProjects({ token, dispatch, isCancelled: () => cancelled });
		return () => {
			cancelled = true;
		};
	}, [token, projectKey]);

	const view = projectKey === undefined ? undefined : state.views[projectKey];
	useEffect(() => {
		if (projectKey === undefined || view?.state !== "no-project-root") return;
		let cancelled = false;
		void loadSessions({ token, projectKey, dispatch, isCancelled: () => cancelled });
		return () => {
			cancelled = true;
		};
	}, [token, projectKey, view]);

	return state;
}
