import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/archive/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/shared/judgeLiveness/index.js", () => ({ default: vi.fn(() => false) }));

import archiveSessionLog from "@/service/observer/event/archive/index.js";
import archiveSession from "./index.js";

const mockArchive = archiveSessionLog as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";

function makeContext() {
	return {
		now: () => 1000,
		store: {
			drop: vi.fn(() => true),
			sessions: vi.fn(({ projectKey }: { projectKey?: string } = {}) =>
				projectKey === KEY ? [{ projectKey: KEY, sessionId: "s2", events: [] }] : [],
			),
		},
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
	await archiveSession({
		req: {} as IncomingMessage,
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/sessions/s1/archive`),
		params: { project, id: "s1" },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

function expectUntouched(ctx: ObserverContext): void {
	expect(ctx.store.drop).not.toHaveBeenCalled();
	expect(ctx.hub.broadcast).not.toHaveBeenCalled();
	expect(ctx.statusPusher.push).not.toHaveBeenCalled();
}

describe("archiveSession route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each(["beta-bbbbbb", "../x"])("answers 404 for the project %s and archives nothing", async (project) => {
		const ctx = makeContext();
		expect(await call(ctx, project)).toEqual({ status: 404, body: { error: { message: "No such project." } } });
		expect(mockArchive).not.toHaveBeenCalled();
		expectUntouched(ctx);
	});

	it.each([
		["invalid-id", 400],
		["not-found", 404],
		["live", 409],
		["unreadable", 409],
	])("answers %s with %i and changes nothing held", async (outcome, status) => {
		mockArchive.mockResolvedValue({ outcome, detail: "bad id" });
		const ctx = makeContext();
		expect((await call(ctx)).status).toBe(status);
		expectUntouched(ctx);
	});

	it("explains a live refusal", async () => {
		mockArchive.mockResolvedValue({ outcome: "live" });
		const result = await call(makeContext());
		expect((result.body.error as { message: string }).message).toBe(
			"Session s1 is still live; only a past session can be archived.",
		);
	});

	it("throws on an unknown outcome instead of reporting success", async () => {
		mockArchive.mockResolvedValue({ outcome: "mystery" });
		const ctx = makeContext();
		await expect(call(ctx)).rejects.toThrow("Unhandled archive outcome");
		expectUntouched(ctx);
	});

	it("drops, broadcasts sessions and projects, answers 200 and pushes status when archived", async () => {
		mockArchive.mockResolvedValue({ outcome: "archived" });
		const ctx = makeContext();
		expect(await call(ctx)).toEqual({ status: 200, body: { data: { archived: "s1" } } });
		expect(mockArchive).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.store.drop).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.hub.broadcast).toHaveBeenCalledWith(expect.objectContaining({ name: "sessions", projectKey: KEY }));
		expect(ctx.hub.broadcast).toHaveBeenCalledWith(expect.objectContaining({ name: "projects", unfilteredOnly: true }));
		expect(ctx.statusPusher.push).toHaveBeenCalledWith(KEY);
	});

	it("lets a throw from the move propagate", async () => {
		mockArchive.mockRejectedValue(new Error("runtime location broken"));
		const ctx = makeContext();
		await expect(call(ctx)).rejects.toThrow("runtime location broken");
		expectUntouched(ctx);
	});
});
