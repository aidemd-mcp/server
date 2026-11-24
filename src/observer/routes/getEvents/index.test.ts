import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";
import getEvents from "./index.js";

const KEY = "alpha-aaaaaa";
const SESSIONS = [
	{ projectKey: KEY, sessionId: "a", events: [] },
	{ projectKey: KEY, sessionId: "b", events: [] },
];

async function call({ query = "", project = KEY }: { query?: string; project?: string } = {}): Promise<{
	status: number;
	body: { data: { sessions: unknown[] } };
}> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const ctx = {
		store: { sessions: vi.fn(({ projectKey }: { projectKey?: string } = {}) => (projectKey === KEY ? SESSIONS : [])) },
	} as unknown as ObserverContext;
	await getEvents({
		req: {} as RouteInput["req"],
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/events${query}`),
		params: { project },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("getEvents", () => {
	it("lists every session of the project", async () => {
		expect(await call()).toEqual({ status: 200, body: { data: { sessions: SESSIONS } } });
	});

	it("filters to the one session when ?session= is given", async () => {
		expect((await call({ query: "?session=b" })).body.data.sessions).toEqual([SESSIONS[1]]);
	});

	it("answers an empty list for an unknown session id", async () => {
		expect(await call({ query: "?session=zzz" })).toEqual({ status: 200, body: { data: { sessions: [] } } });
	});

	it.each(["beta-bbbbbb", "../x", "plain"])("answers 404 for the project %s", async (project) => {
		expect(await call({ project })).toEqual({ status: 404, body: { error: { message: "No such project." } } });
	});
});
