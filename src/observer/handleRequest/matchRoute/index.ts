import getAsset from "../../routes/getAsset/index.js";
import deleteSession from "../../routes/deleteSession/index.js";
import getEvents from "../../routes/getEvents/index.js";
import getFile from "../../routes/getFile/index.js";
import getIndex from "../../routes/getIndex/index.js";
import getStatus from "../../routes/getStatus/index.js";
import getSessionPage from "../../routes/getSessionPage/index.js";
import getTask from "../../routes/getTask/index.js";
import listProjects from "../../routes/listProjects/index.js";
import listSessions from "../../routes/listSessions/index.js";
import postEvent from "../../routes/postEvent/index.js";
import postShutdown from "../../routes/postShutdown/index.js";
import streamUpdates from "../../routes/streamUpdates/index.js";
import routeTable from "../../shared/routeTable/index.js";
import type { RouteHandler } from "../../types/index.js";

type TokenAccess = (typeof routeTable)[number]["tokenAccess"];

type RouteRow = {
	method: string;
	pattern: string[];
	handler: RouteHandler;
	/** True when the route reads the held state and so waits for the replay to finish. */
	readRoute: boolean;
	/** Whether the route needs the observer token; see the route table. */
	tokenAccess: TokenAccess;
};

type MatchResult =
	| { kind: "route"; handler: RouteHandler; params: Record<string, string>; readRoute: boolean; tokenAccess: TokenAccess }
	| { kind: "not-found" }
	| { kind: "method-not-allowed"; allow: string[] };

const HANDLERS: Record<(typeof routeTable)[number]["name"], RouteHandler> = {
	getIndex,
	getSessionPage,
	getAsset,
	listProjects,
	getStatus,
	getEvents,
	getFile,
	getTask,
	listSessions,
	deleteSession,
	postEvent,
	postShutdown,
	streamUpdates,
};

const ROUTE_TABLE: RouteRow[] = routeTable.map(({ name, method, path, readRoute, tokenAccess }) => ({
	method,
	pattern: path.split("/").slice(1),
	handler: HANDLERS[name],
	readRoute,
	tokenAccess,
}));

/** Matches a path against a row's segments; returns the decoded params, or null when it does not match. */
function matchPattern({ pattern, segments }: { pattern: string[]; segments: string[] }): Record<string, string> | null {
	if (pattern.length !== segments.length) return null;
	const params: Record<string, string> = {};
	for (let index = 0; index < pattern.length; index += 1) {
		const expected = pattern[index];
		const actual = segments[index];
		if (!expected.startsWith(":")) {
			if (expected !== actual) return null;
			continue;
		}
		if (actual === "") return null;
		params[expected.slice(1)] = decodeURIComponent(actual);
	}
	return params;
}

/**
 * Looks a request up in the route table. A path and method that match give the
 * handler with its decoded params; a path that matches only under other
 * methods gives those methods; anything else, including a path whose
 * encoding is broken, is not found.
 */
export default function matchRoute({ method, pathname }: { method: string; pathname: string }): MatchResult {
	const segments = pathname.split("/").slice(1);
	const allow: string[] = [];
	for (const candidate of ROUTE_TABLE) {
		let params: Record<string, string> | null;
		try {
			params = matchPattern({ pattern: candidate.pattern, segments });
		} catch {
			return { kind: "not-found" };
		}
		if (!params) continue;
		if (candidate.method === method) {
			return { kind: "route", handler: candidate.handler, params, readRoute: candidate.readRoute, tokenAccess: candidate.tokenAccess };
		}
		allow.push(candidate.method);
	}
	return allow.length > 0 ? { kind: "method-not-allowed", allow } : { kind: "not-found" };
}
