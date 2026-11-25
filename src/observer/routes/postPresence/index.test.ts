import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import announceSessions from "../../shared/announceSessions/index.js";
import broadcastProjects from "../../shared/broadcastProjects/index.js";
import postPresence from "./index.js";

vi.mock("../../shared/announceSessions/index.js", () => ({ default: vi.fn() }));
vi.mock("../../shared/broadcastProjects/index.js", () => ({ default: vi.fn() }));

const mockAnnounceSessions = announceSessions as ReturnType<typeof vi.fn>;
const mockBroadcastProjects = broadcastProjects as ReturnType<typeof vi.fn>;

const KEY = "project-abc123";
const PING = { claudeSessionId: "claude-session-1" };

function makeContext({ ready = true, held = true }: { ready?: boolean; held?: boolean } = {}): ObserverContext {
	return {
		store: {
			isReady: vi.fn(() => ready),
			sessions: vi.fn(() => (held ? [{ sessionId: "s1" }] : [])),
			accept: vi.fn(),
		},
		hub: { broadcast: vi.fn() },
		statusPusher: { push: vi.fn() },
	} as unknown as ObserverContext;
}

async function post({
	ctx,
	body,
	contentType = "application/json",
	projectHeader = KEY,
}: {
	ctx: ObserverContext;
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
		},
	} as unknown as ServerResponse;
	const req = Object.assign(Readable.from([Buffer.from(body)]), {
		headers: {
			"content-type": contentType,
			...(projectHeader === null ? {} : { [protocol.projectHeader]: projectHeader }),
		},
	}) as unknown as IncomingMessage;
	await postPresence({ req, res, url: new URL(`http://127.0.0.1${protocol.presenceRoute}`), params: {}, ctx });
	return { status: sent.status, body: JSON.parse(sent.body) };
}

describe("postPresence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([
		["a missing project header", null],
		["a path-like project key", "../x"],
		["a key without the hash suffix", "project"],
		["a repeated project header", [KEY, KEY]],
	])("answers 400 for %s and pushes nothing", async (_label, projectHeader) => {
		const ctx = makeContext();
		const result = await post({ ctx, body: JSON.stringify(PING), projectHeader });
		expect(result.status).toBe(400);
		expect((result.body.error as { message: string }).message).toBe("Missing or invalid project key.");
		expect(mockAnnounceSessions).not.toHaveBeenCalled();
		expect(mockBroadcastProjects).not.toHaveBeenCalled();
	});

	it("answers 415 for a media type other than application/json", async () => {
		const result = await post({ ctx: makeContext(), body: JSON.stringify(PING), contentType: "text/plain" });
		expect(result.status).toBe(415);
	});

	it("answers 413 for a body over 4 096 bytes", async () => {
		const result = await post({ ctx: makeContext(), body: "x".repeat(4_097) });
		expect(result.status).toBe(413);
		expect(mockAnnounceSessions).not.toHaveBeenCalled();
	});

	it("answers 400 for malformed JSON", async () => {
		const result = await post({ ctx: makeContext(), body: "{nope" });
		expect(result.status).toBe(400);
	});

	it("answers 400 for an unknown key in the body", async () => {
		const result = await post({ ctx: makeContext(), body: JSON.stringify({ ...PING, state: "waiting" }) });
		expect(result.status).toBe(400);
		expect(typeof (result.body.error as { details: string }).details).toBe("string");
		expect(mockAnnounceSessions).not.toHaveBeenCalled();
	});

	it("answers 400 for a body without the Claude session id", async () => {
		const result = await post({ ctx: makeContext(), body: JSON.stringify({}) });
		expect(result.status).toBe(400);
	});

	it("answers 202 and announces the sessions of a project the store holds", async () => {
		const ctx = makeContext({ held: true });
		const result = await post({ ctx, body: JSON.stringify(PING) });
		expect(result).toEqual({ status: 202, body: { data: { outcome: "accepted" } } });
		expect(mockAnnounceSessions).toHaveBeenCalledWith({ ctx, projectKey: KEY });
		expect(mockBroadcastProjects).not.toHaveBeenCalled();
		expect(ctx.store.accept).not.toHaveBeenCalled();
	});

	it("answers 202 and pushes only the project list for a project the store does not hold", async () => {
		const ctx = makeContext({ held: false });
		const result = await post({ ctx, body: JSON.stringify(PING) });
		expect(result.status).toBe(202);
		expect(mockBroadcastProjects).toHaveBeenCalledWith({ ctx });
		expect(mockAnnounceSessions).not.toHaveBeenCalled();
	});

	it("answers 202 during replay and pushes nothing", async () => {
		const ctx = makeContext({ ready: false });
		const result = await post({ ctx, body: JSON.stringify(PING) });
		expect(result).toEqual({ status: 202, body: { data: { outcome: "accepted" } } });
		expect(mockAnnounceSessions).not.toHaveBeenCalled();
		expect(mockBroadcastProjects).not.toHaveBeenCalled();
	});

	it("keeps the answer when a push fails and writes one stderr line", async () => {
		const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		mockAnnounceSessions.mockRejectedValueOnce(new Error("disk gone"));
		const result = await post({ ctx: makeContext(), body: JSON.stringify(PING) });
		expect(result.status).toBe(202);
		expect(write).toHaveBeenCalledWith(expect.stringContaining("disk gone"));
		write.mockRestore();
	});
});
