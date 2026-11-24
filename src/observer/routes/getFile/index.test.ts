import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";
import getFile from "./index.js";

const KEY = "alpha-aaaaaa";
const NO_ROOT_KEY = "gamma-cccccc";
let projectRoot: string;

beforeEach(async () => {
	projectRoot = await realpath(await mkdtemp(join(tmpdir(), "aide-getfile-")));
	await mkdir(join(projectRoot, "sub"));
	await writeFile(join(projectRoot, "sub", "note.md"), "# héllo");
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

function makeStarted({ sessionId, root }: { sessionId: string; root?: string }) {
	return {
		v: 1,
		ts: "2026-01-01T00:00:00.000Z",
		sessionId,
		seq: 1,
		pid: 1,
		kind: "session_started",
		...(root !== undefined && { projectRoot: root }),
	};
}

async function call({ query, project = KEY }: { query: string; project?: string }): Promise<{ status: number; body: Record<string, unknown> }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const held: Record<string, unknown[]> = {
		[KEY]: [{ projectKey: KEY, sessionId: "a", events: [makeStarted({ sessionId: "a", root: projectRoot })] }],
		[NO_ROOT_KEY]: [{ projectKey: NO_ROOT_KEY, sessionId: "g", events: [makeStarted({ sessionId: "g" })] }],
	};
	const ctx = {
		store: { sessions: ({ projectKey }: { projectKey?: string } = {}) => (projectKey === undefined ? [] : (held[projectKey] ?? [])) },
	} as unknown as ObserverContext;
	await getFile({
		req: {} as RouteInput["req"],
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/file${query}`),
		params: { project },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("getFile", () => {
	it("answers 200 with the project-relative path and the text", async () => {
		expect(await call({ query: "?path=sub/note.md" })).toEqual({
			status: 200,
			body: { data: { path: "sub/note.md", text: "# héllo" } },
		});
	});

	it.each(["", "?path="])("answers 400 when the path is missing (%s)", async (query) => {
		expect((await call({ query })).status).toBe(400);
	});

	it("answers 403 outside the root", async () => {
		expect((await call({ query: `?path=${encodeURIComponent("../outside.txt")}` })).status).toBe(403);
	});

	it("answers 404 for a missing file", async () => {
		expect((await call({ query: "?path=nope.txt" })).status).toBe(404);
	});

	it("answers 400 for a folder", async () => {
		expect((await call({ query: "?path=sub" })).status).toBe(400);
	});

	it("answers 413 above 2 MiB and serves a file at the limit", async () => {
		await writeFile(join(projectRoot, "big.txt"), "a".repeat(2_097_153));
		await writeFile(join(projectRoot, "edge.txt"), "a".repeat(2_097_152));

		expect((await call({ query: "?path=big.txt" })).status).toBe(413);
		expect((await call({ query: "?path=edge.txt" })).status).toBe(200);
	});

	it("answers 409 naming the missing root for a project no session of which reported one", async () => {
		const { status, body } = await call({ query: "?path=sub/note.md", project: NO_ROOT_KEY });

		expect(status).toBe(409);
		expect((body.error as { message: string }).message).toContain("reported its project root");
	});

	it.each(["beta-bbbbbb", "../x"])("answers 404 for the project %s", async (project) => {
		const { status, body } = await call({ query: "?path=sub/note.md", project });

		expect(status).toBe(404);
		expect(body).toEqual({ error: { message: "No such project." } });
	});
});
