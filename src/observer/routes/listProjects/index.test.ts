import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";

vi.mock("../../shared/summarizeProjects/index.js", () => ({ default: vi.fn() }));

import summarizeProjects from "../../shared/summarizeProjects/index.js";
import listProjects from "./index.js";

const mockSummarize = summarizeProjects as ReturnType<typeof vi.fn>;

describe("listProjects", () => {
	it("answers 200 with the summaries of every held session at ctx.now()", async () => {
		const held = [{ projectKey: "a-aaaaaa", sessionId: "s", events: [] }];
		mockSummarize.mockReturnValue([{ projectKey: "a-aaaaaa" }]);
		const sent = { status: 0, body: "" };
		const res = {
			writeHead: (status: number) => {
				sent.status = status;
			},
			end: (body: string) => {
				sent.body = body;
			},
		} as unknown as ServerResponse;
		const sessions = vi.fn(() => held);
		const ctx = { store: { sessions }, now: () => 99 } as unknown as ObserverContext;

		await listProjects({ req: {} as RouteInput["req"], res, url: new URL("http://127.0.0.1/"), params: {}, ctx });

		expect(sessions).toHaveBeenCalledWith();
		expect(mockSummarize).toHaveBeenCalledWith({ sessions: held, now: 99 });
		expect(sent.status).toBe(200);
		expect(JSON.parse(sent.body)).toEqual({ data: { projects: [{ projectKey: "a-aaaaaa" }] } });
	});
});
