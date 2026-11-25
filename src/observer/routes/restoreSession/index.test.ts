import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/restore/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/readLiveness/index.js", () => ({ default: vi.fn(async () => ({ sessions: {}, unlinked: [] })) }));

import restoreSessionLog from "@/service/observer/event/restore/index.js";
import restoreSession from "./index.js";

const mockRestore = restoreSessionLog as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";
const EVENTS = [
	{ sessionId: "s1", seq: 1 },
	{ sessionId: "s1", seq: 2 },
];

function makeContext() {
	return {
		now: () => 1000,
		store: { accept: vi.fn(() => "added"), sessions: vi.fn(() => []) },
		hub: { broadcast: vi.fn() },
		statusPusher: { push: vi.fn() },
	} as unknown as ObserverContext;
}

async function call(ctx: ObserverContext, project = KEY): Promise<{ status: number; body: Record<string, unknown> }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (text: string) => {
			sent.body = text;
		},
	} as unknown as ServerResponse;
	await restoreSession({
		req: {} as IncomingMessage,
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/archive/s1/restore`),
		params: { project, id: "s1" },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

function expectUntouched(ctx: ObserverContext): void {
	expect(ctx.store.accept).not.toHaveBeenCalled();
	expect(ctx.hub.broadcast).not.toHaveBeenCalled();
	expect(ctx.statusPusher.push).not.toHaveBeenCalled();
}

describe("restoreSession route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("answers 404 for a key that is not a project key and restores nothing", async () => {
		const ctx = makeContext();
		expect(await call(ctx, "../x")).toEqual({ status: 404, body: { error: { message: "No such project." } } });
		expect(mockRestore).not.toHaveBeenCalled();
	});

	it.each([
		["invalid-id", 400],
		["not-found", 404],
		["exists", 409],
	])("answers %s with %i and holds nothing", async (outcome, status) => {
		mockRestore.mockResolvedValue({ outcome, detail: "bad id" });
		const ctx = makeContext();
		expect((await call(ctx)).status).toBe(status);
		expectUntouched(ctx);
	});

	it("throws on an unknown outcome instead of reporting success", async () => {
		mockRestore.mockResolvedValue({ outcome: "mystery" });
		const ctx = makeContext();
		await expect(call(ctx)).rejects.toThrow("Unhandled restore outcome");
		expectUntouched(ctx);
	});

	it("holds the restored events, broadcasts and pushes status, answering 200", async () => {
		mockRestore.mockResolvedValue({ outcome: "restored", session: { sessionId: "s1", events: EVENTS } });
		const ctx = makeContext();
		expect(await call(ctx)).toEqual({ status: 200, body: { data: { restored: "s1" } } });
		expect(mockRestore).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.store.accept).toHaveBeenCalledTimes(2);
		expect(ctx.store.accept).toHaveBeenCalledWith({ event: EVENTS[0], projectKey: KEY });
		expect(ctx.hub.broadcast).toHaveBeenCalledWith(expect.objectContaining({ name: "sessions", projectKey: KEY }));
		expect(ctx.hub.broadcast).toHaveBeenCalledWith(expect.objectContaining({ name: "projects", unfilteredOnly: true }));
		expect(ctx.statusPusher.push).toHaveBeenCalledWith(KEY);
	});
});
