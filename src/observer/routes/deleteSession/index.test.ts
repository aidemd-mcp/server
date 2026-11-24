import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/delete/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/observer/event/shared/judgeLiveness/index.js", () => ({ default: vi.fn(() => false) }));

import deleteSessionLog from "@/service/observer/event/delete/index.js";
import deleteSession from "./index.js";

const mockDelete = deleteSessionLog as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";

function makeContext() {
	return {
		now: () => 1000,
		store: {
			drop: vi.fn(() => true),
			sessions: vi.fn(({ projectKey }: { projectKey?: string } = {}) =>
				projectKey === KEY ? [{ projectKey: KEY, sessionId: "s1", events: [] }] : [],
			),
		},
		hub: { broadcast: vi.fn() },
		statusPusher: { push: vi.fn() },
	} as unknown as ObserverContext;
}

async function call(
	ctx: ObserverContext,
	project = KEY,
): Promise<{ status: number; body: Record<string, unknown> }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (text: string) => {
			sent.body = text;
		},
	} as unknown as ServerResponse;
	await deleteSession({
		req: {} as IncomingMessage,
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/sessions/s1`),
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

describe("deleteSession route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each(["beta-bbbbbb", "../x"])("answers 404 for the project %s and deletes nothing", async (project) => {
		const ctx = makeContext();
		expect(await call(ctx, project)).toEqual({ status: 404, body: { error: { message: "No such project." } } });
		expect(mockDelete).not.toHaveBeenCalled();
		expectUntouched(ctx);
	});

	it("answers 400 with the detail for an invalid id", async () => {
		mockDelete.mockResolvedValue({ outcome: "invalid-id", detail: "bad id" });
		const ctx = makeContext();
		const result = await call(ctx);
		expect(result.status).toBe(400);
		expect((result.body.error as { details: string }).details).toBe("bad id");
		expectUntouched(ctx);
	});

	it("answers 404 for an unknown session", async () => {
		mockDelete.mockResolvedValue({ outcome: "not-found" });
		const ctx = makeContext();
		expect((await call(ctx)).status).toBe(404);
		expectUntouched(ctx);
	});

	it("answers 409 with the live message for a live session", async () => {
		mockDelete.mockResolvedValue({ outcome: "live" });
		const ctx = makeContext();
		const result = await call(ctx);
		expect(result.status).toBe(409);
		expect((result.body.error as { message: string }).message).toBe(
			"Session s1 is still live; only a past session can be deleted.",
		);
		expectUntouched(ctx);
	});

	it("answers 409 and deletes nothing for an unreadable session", async () => {
		mockDelete.mockResolvedValue({ outcome: "unreadable" });
		const ctx = makeContext();
		const result = await call(ctx);
		expect(result.status).toBe(409);
		expect((result.body.error as { message: string }).message).toBe(
			"Session s1 could not be read, so it cannot be judged past; it was not deleted.",
		);
		expectUntouched(ctx);
	});

	it("throws on an unknown outcome instead of reporting success", async () => {
		mockDelete.mockResolvedValue({ outcome: "mystery" });
		const ctx = makeContext();
		await expect(call(ctx)).rejects.toThrow("Unhandled delete outcome");
		expectUntouched(ctx);
	});

	it("drops, broadcasts sessions, answers 200 and pushes status when deleted", async () => {
		mockDelete.mockResolvedValue({ outcome: "deleted" });
		const ctx = makeContext();
		const result = await call(ctx);
		expect(result).toEqual({ status: 200, body: { data: { deleted: "s1" } } });
		expect(mockDelete).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.store.drop).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.hub.broadcast).toHaveBeenCalledWith({
			name: "sessions",
			data: { projectKey: KEY, sessions: [expect.objectContaining({ sessionId: "s1" })] },
			projectKey: KEY,
		});
		expect(ctx.hub.broadcast).toHaveBeenCalledWith({
			name: "projects",
			data: { projects: [] },
			unfilteredOnly: true,
		});
		expect(ctx.statusPusher.push).toHaveBeenCalledTimes(1);
		expect(ctx.statusPusher.push).toHaveBeenCalledWith(KEY);
	});

	it("lets a throw from the delete propagate", async () => {
		mockDelete.mockRejectedValue(new Error("runtime location broken"));
		const ctx = makeContext();
		await expect(call(ctx)).rejects.toThrow("runtime location broken");
		expectUntouched(ctx);
	});
});
