import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/delete/index.js", () => ({ default: vi.fn() }));

import deleteSessionLog from "@/service/observer/event/delete/index.js";
import deleteSession from "./index.js";

const mockDelete = deleteSessionLog as ReturnType<typeof vi.fn>;

const KEY = "alpha-aaaaaa";

function makeContext() {
	return {
		now: () => 1000,
		store: { drop: vi.fn(), accept: vi.fn(), sessions: vi.fn(() => []) },
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
	await deleteSession({
		req: {} as IncomingMessage,
		res,
		url: new URL(`http://127.0.0.1/api/projects/${project}/archive/s1`),
		params: { project, id: "s1" },
		ctx,
	});
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("deleteSession route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("answers 404 for a key that is not a project key and deletes nothing", async () => {
		expect(await call(makeContext(), "../x")).toEqual({ status: 404, body: { error: { message: "No such project." } } });
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("answers 400 with the detail for an invalid id", async () => {
		mockDelete.mockResolvedValue({ outcome: "invalid-id", detail: "bad id" });
		const result = await call(makeContext());
		expect(result.status).toBe(400);
		expect((result.body.error as { details: string }).details).toBe("bad id");
	});

	it("answers 404 for a session that is not archived", async () => {
		mockDelete.mockResolvedValue({ outcome: "not-found" });
		expect(await call(makeContext())).toEqual({
			status: 404,
			body: { error: { message: "Archived session s1 was not found." } },
		});
	});

	it("throws on an unknown outcome instead of reporting success", async () => {
		mockDelete.mockResolvedValue({ outcome: "mystery" });
		await expect(call(makeContext())).rejects.toThrow("Unhandled delete outcome");
	});

	it("answers 200 and touches no held state when deleted", async () => {
		mockDelete.mockResolvedValue({ outcome: "deleted" });
		const ctx = makeContext();
		expect(await call(ctx)).toEqual({ status: 200, body: { data: { deleted: "s1" } } });
		expect(mockDelete).toHaveBeenCalledWith({ projectKey: KEY, sessionId: "s1" });
		expect(ctx.store.drop).not.toHaveBeenCalled();
		expect(ctx.hub.broadcast).not.toHaveBeenCalled();
	});

	it("lets a throw from the delete propagate", async () => {
		mockDelete.mockRejectedValue(new Error("runtime location broken"));
		await expect(call(makeContext())).rejects.toThrow("runtime location broken");
	});
});
