import { describe, expect, it } from "vitest";
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
import streamUpdates from "../../routes/streamUpdates/index.js";
import matchRoute from "./index.js";

describe("matchRoute — resolves every route", () => {
	it.each([
		{ method: "GET", pathname: "/", handler: getIndex, params: {}, readRoute: false, tokenAccess: "open-for-html" },
		{ method: "GET", pathname: "/p/proj-abcdef/s/abc-123", handler: getSessionPage, params: { project: "proj-abcdef", session: "abc-123" }, readRoute: false, tokenAccess: "open" },
		{ method: "GET", pathname: "/assets/page.js", handler: getAsset, params: { name: "page.js" }, readRoute: false, tokenAccess: "open" },
		{ method: "GET", pathname: "/api/projects", handler: listProjects, params: {}, readRoute: true, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/projects/proj-abcdef/status", handler: getStatus, params: { project: "proj-abcdef" }, readRoute: true, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/projects/proj-abcdef/events", handler: getEvents, params: { project: "proj-abcdef" }, readRoute: true, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/projects/proj-abcdef/file", handler: getFile, params: { project: "proj-abcdef" }, readRoute: true, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/projects/proj-abcdef/task/my-task", handler: getTask, params: { project: "proj-abcdef", slug: "my-task" }, readRoute: true, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/projects/proj-abcdef/sessions", handler: listSessions, params: { project: "proj-abcdef" }, readRoute: true, tokenAccess: "required" },
		{ method: "DELETE", pathname: "/api/projects/proj-abcdef/sessions/abc-123", handler: deleteSession, params: { project: "proj-abcdef", id: "abc-123" }, readRoute: true, tokenAccess: "required" },
		{ method: "POST", pathname: "/api/events", handler: postEvent, params: {}, readRoute: false, tokenAccess: "required" },
		{ method: "GET", pathname: "/api/stream", handler: streamUpdates, params: {}, readRoute: true, tokenAccess: "required" },
	])("$method $pathname", ({ method, pathname, handler, params, readRoute, tokenAccess }) => {
		expect(matchRoute({ method, pathname })).toEqual({ kind: "route", handler, params, readRoute, tokenAccess });
	});

	it("decodes a param once", () => {
		const result = matchRoute({ method: "GET", pathname: "/api/projects/proj-abcdef/task/a%20b%2Fc" });

		expect(result).toMatchObject({ kind: "route", params: { project: "proj-abcdef", slug: "a b/c" } });
	});
});

describe("matchRoute — refusals", () => {
	it("answers 405 with the path's methods when only the method is wrong", () => {
		expect(matchRoute({ method: "PUT", pathname: "/api/projects/proj-abcdef/sessions" })).toEqual({
			kind: "method-not-allowed",
			allow: ["GET"],
		});
	});

	it("lists every method a path accepts", () => {
		expect(matchRoute({ method: "GET", pathname: "/api/projects/proj-abcdef/sessions/abc" })).toEqual({
			kind: "method-not-allowed",
			allow: ["DELETE"],
		});
	});

	it("answers 405 for a POST to an asset", () => {
		expect(matchRoute({ method: "POST", pathname: "/assets/x" })).toEqual({ kind: "method-not-allowed", allow: ["GET"] });
	});

	it.each([
		"/nope",
		"/api",
		"/api/status",
		"/api/sessions",
		"/api/projects/proj-abcdef/status/",
		"/api/projects//status",
		"/api/projects/proj-abcdef/task/",
		"/api/projects/proj-abcdef/task/a/b",
		"/api/projects/%E0%A4%A/status",
	])(
		"%s is not found",
		(pathname) => {
			expect(matchRoute({ method: "GET", pathname })).toEqual({ kind: "not-found" });
		},
	);
});
