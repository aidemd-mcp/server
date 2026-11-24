import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import broadcastProjects from "../../shared/broadcastProjects/index.js";
import postEvent from "./index.js";

vi.mock("../../shared/broadcastProjects/index.js", () => ({ default: vi.fn() }));

const mockBroadcastProjects = broadcastProjects as ReturnType<typeof vi.fn>;

const KEY = "project-abc123";
const EVENT = { v: 1, ts: "2026-01-01T00:00:01.000Z", sessionId: "s1", seq: 1, pid: 4242, kind: "prompt", text: "hello" };

function makeContext({ outcome }: { outcome: "held" | "added" | "duplicate" | "project-mismatch" }) {
	const order: string[] = [];
	const ctx = {
		store: { accept: vi.fn(() => outcome) },
		hub: { broadcast: vi.fn(() => order.push("broadcast")) },
		statusPusher: { push: vi.fn(() => order.push("push")) },
	} as unknown as ObserverContext;
	return { ctx, order };
}

async function post({
	ctx,
	order,
	body,
	contentType = "application/json",
	projectHeader = KEY,
}: {
	ctx: ObserverContext;
	order: string[];
	body: string;
	contentType?: string;
	projectHeader?: string | string[] | null;
}): Promise<{ status: number; body: Record<string, unknown> }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (text: string) => {
			sent.body = text;
			order.push("response");
		},
	} as unknown as ServerResponse;
	const req = Object.assign(Readable.from([Buffer.from(body)]), {
		headers: {
			"content-type": contentType,
			...(projectHeader === null ? {} : { [protocol.projectHeader]: projectHeader }),
		},
	}) as unknown as IncomingMessage;
	await postEvent({ req, res, url: new URL("http://127.0.0.1/api/events"), params: {}, ctx });
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("postEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("answers 415 for a media type other than application/json", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT), contentType: "text/plain" });
		expect(result.status).toBe(415);
		expect(ctx.store.accept).not.toHaveBeenCalled();
	});

	it("accepts a media type with parameters in any case", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT), contentType: "Application/JSON; charset=utf-8" });
		expect(result.status).toBe(200);
	});

	it("answers 400 for malformed JSON", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: "{nope" });
		expect(result.status).toBe(400);
		expect(ctx.store.accept).not.toHaveBeenCalled();
	});

	it("answers 400 with the Zod message in details for an off-schema event", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: JSON.stringify({ ...EVENT, kind: "nonsense" }) });
		expect(result.status).toBe(400);
		expect(typeof (result.body.error as { details: string }).details).toBe("string");
		expect(ctx.store.accept).not.toHaveBeenCalled();
	});

	it("answers 413 for a body over 1 MiB", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: "x".repeat(1_048_577) });
		expect(result.status).toBe(413);
		expect(ctx.store.accept).not.toHaveBeenCalled();
	});

	it("answers 202 held during replay without broadcasting or pushing", async () => {
		const { ctx, order } = makeContext({ outcome: "held" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT) });
		expect(result).toEqual({ status: 202, body: { data: { outcome: "held" } } });
		expect(ctx.hub.broadcast).not.toHaveBeenCalled();
		expect(ctx.statusPusher.push).not.toHaveBeenCalled();
		expect(mockBroadcastProjects).not.toHaveBeenCalled();
	});

	it("answers 200 duplicate without broadcasting or pushing", async () => {
		const { ctx, order } = makeContext({ outcome: "duplicate" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT) });
		expect(result).toEqual({ status: 200, body: { data: { outcome: "duplicate" } } });
		expect(ctx.hub.broadcast).not.toHaveBeenCalled();
		expect(ctx.statusPusher.push).not.toHaveBeenCalled();
	});

	it("broadcasts an added event once before the response, then pushes status once", async () => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT) });
		expect(result).toEqual({ status: 200, body: { data: { outcome: "accepted" } } });
		expect(ctx.hub.broadcast).toHaveBeenCalledTimes(1);
		expect(ctx.hub.broadcast).toHaveBeenCalledWith({
			name: "aide-event",
			data: { projectKey: KEY, event: EVENT },
			projectKey: KEY,
		});
		expect(ctx.store.accept).toHaveBeenCalledWith({ event: EVENT, projectKey: KEY });
		expect(ctx.statusPusher.push).toHaveBeenCalledTimes(1);
		expect(mockBroadcastProjects).toHaveBeenCalledWith({ ctx });
		expect(order).toEqual(["broadcast", "response", "push"]);
	});

	it.each([
		["a missing project header", null],
		["a path-like project key", "../x"],
		["a key without the hash suffix", "project"],
		["a repeated project header", ["project-abc123", "project-abc123"]],
	])("answers 400 for %s before the body is read", async (_label, projectHeader) => {
		const { ctx, order } = makeContext({ outcome: "added" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT), projectHeader });
		expect(result.status).toBe(400);
		expect((result.body.error as { message: string }).message).toBe("Missing or invalid project key.");
		expect(ctx.store.accept).not.toHaveBeenCalled();
		expect(ctx.hub.broadcast).not.toHaveBeenCalled();
	});

	it("answers 409 when the key does not match the session's key and never broadcasts or pushes", async () => {
		const { ctx, order } = makeContext({ outcome: "project-mismatch" });
		const result = await post({ ctx, order, body: JSON.stringify(EVENT) });
		expect(result.status).toBe(409);
		expect(ctx.hub.broadcast).not.toHaveBeenCalled();
		expect(ctx.statusPusher.push).not.toHaveBeenCalled();
	});
});
