import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";

vi.mock("../../shared/summarizeSessions/index.js", () => ({ default: vi.fn() }));
vi.mock("../../shared/readHeldLiveness/index.js", () => ({ default: vi.fn() }));

import readHeldLiveness from "../../shared/readHeldLiveness/index.js";
import summarizeSessions from "../../shared/summarizeSessions/index.js";
import listSessions from "./index.js";

const mockRead = readHeldLiveness as ReturnType<typeof vi.fn>;
const mockSummarize = summarizeSessions as ReturnType<typeof vi.fn>;
const KEY = "alpha-aaaaaa";

function makeRes(sent: { status: number; body: string }): ServerResponse {
	return {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
}

describe("listSessions", () => {
	it("answers 200 with the summaries of that project's sessions with the liveness read from disk", async () => {
		const held = [{ projectKey: KEY, sessionId: "a", events: [] }];
		const judged = { a: { state: "waiting", lastActivityAt: null, quietMinutes: 0, maybeStuck: false } };
		mockRead.mockResolvedValue(new Map([[KEY, { sessions: judged, unlinked: [] }]]));
		mockSummarize.mockReturnValue([{ sessionId: "a" }]);
		const sent = { status: 0, body: "" };
		const sessions = vi.fn(({ projectKey }: { projectKey?: string } = {}) => (projectKey === KEY ? held : []));
		const ctx = { store: { sessions } } as unknown as ObserverContext;

		await listSessions({ req: {} as RouteInput["req"], res: makeRes(sent), url: new URL("http://127.0.0.1/"), params: { project: KEY }, ctx });

		expect(sessions).toHaveBeenCalledWith({ projectKey: KEY });
		expect(mockRead).toHaveBeenCalledWith({ ctx, projectKey: KEY });
		expect(mockSummarize).toHaveBeenCalledWith({ sessions: held, liveness: judged });
		expect(sent.status).toBe(200);
		expect(JSON.parse(sent.body)).toEqual({ data: { sessions: [{ sessionId: "a" }] } });
	});

	it("answers 404 for a project with no held session", async () => {
		const sent = { status: 0, body: "" };
		const ctx = { store: { sessions: () => [] } } as unknown as ObserverContext;

		await listSessions({ req: {} as RouteInput["req"], res: makeRes(sent), url: new URL("http://127.0.0.1/"), params: { project: KEY }, ctx });

		expect(sent.status).toBe(404);
		expect(JSON.parse(sent.body)).toEqual({ error: { message: "No such project." } });
	});
});
