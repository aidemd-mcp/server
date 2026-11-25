import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/readArchive/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/shared/judgeLiveness/index.js", () => ({ default: vi.fn(() => true) }));

import readArchive from "@/service/observer/event/readArchive/index.js";
import listArchived from "./index.js";

const mockRead = readArchive as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";

async function call(project = KEY): Promise<{ status: number; body: Record<string, unknown> }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (text: string) => {
			sent.body = text;
		},
	} as unknown as ServerResponse;
	await listArchived({
		req: {} as IncomingMessage,
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/archive`),
		params: { project },
		ctx: { now: () => 1000 } as unknown as ObserverContext,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("listArchived route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("answers 404 for a key that is not a project key and reads nothing", async () => {
		expect((await call("../x")).status).toBe(404);
		expect(mockRead).not.toHaveBeenCalled();
	});

	it("lists the archived sessions as rows that are never live", async () => {
		mockRead.mockResolvedValue([
			{
				sessionId: "s1",
				started: null,
				events: [{ v: 1, ts: "2026-11-22T09:00:00.000Z", sessionId: "s1", seq: 1, pid: 1, kind: "release", version: "1.0.0" }],
				skippedLines: 0,
				live: false,
				unreadable: false,
			},
		]);

		const result = await call();

		expect(mockRead).toHaveBeenCalledWith({ projectKey: KEY });
		expect(result.status).toBe(200);
		expect(result.body).toEqual({
			data: {
				sessions: [
					{
						sessionId: "s1",
						startedAt: "2026-11-22T09:00:00.000Z",
						metadata: null,
						eventCount: 1,
						lastEventAt: "2026-11-22T09:00:00.000Z",
						live: false,
					},
				],
			},
		});
	});

	it("answers an empty list when nothing is archived", async () => {
		mockRead.mockResolvedValue([]);
		expect(await call()).toEqual({ status: 200, body: { data: { sessions: [] } } });
	});
});
