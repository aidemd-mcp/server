import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ObserverContext } from "../../types/index.js";
import streamUpdates from "./index.js";

const KEY = "alpha-aaaaaa";

function makeContext({ order }: { order: string[] }) {
	const mine = [{ projectKey: KEY, sessionId: "a", events: [] }];
	const everyone = [...mine, { projectKey: "beta-bbbbbb", sessionId: "b", events: [] }];
	return {
		mine,
		everyone,
		ctx: {
			store: { sessions: vi.fn(({ projectKey }: { projectKey?: string } = {}) => (projectKey === undefined ? everyone : projectKey === KEY ? mine : [])) },
			hub: { subscribe: vi.fn(() => order.push("subscribe")) },
			statusPusher: { push: vi.fn(() => order.push("push")) },
		} as unknown as ObserverContext,
	};
}

async function call({ ctx, query }: { ctx: ObserverContext; query: string }): Promise<{ res: ServerResponse; sent: { status: number; body: string } }> {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	await streamUpdates({ req: {} as IncomingMessage, res, url: new URL(`http://127.0.0.1/api/stream${query}`), params: {}, ctx });
	return { res, sent };
}

describe("streamUpdates", () => {
	it("subscribes unfiltered with every session as the snapshot and pushes no status", async () => {
		const order: string[] = [];
		const { ctx, everyone } = makeContext({ order });

		const { res } = await call({ ctx, query: "" });

		expect(ctx.hub.subscribe).toHaveBeenCalledWith({ res, snapshot: { sessions: everyone }, projectKey: undefined });
		expect(ctx.statusPusher.push).not.toHaveBeenCalled();
	});

	it("subscribes filtered with only that project's sessions, then pushes that project's status", async () => {
		const order: string[] = [];
		const { ctx, mine } = makeContext({ order });

		const { res } = await call({ ctx, query: `?project=${KEY}` });

		expect(ctx.hub.subscribe).toHaveBeenCalledWith({ res, snapshot: { sessions: mine }, projectKey: KEY });
		expect(ctx.statusPusher.push).toHaveBeenCalledWith(KEY);
		expect(order).toEqual(["subscribe", "push"]);
	});

	it.each(["?project=delta-dddddd", "?project=..%2Fx", "?project="])(
		"answers 404 and opens no stream for %s",
		async (query) => {
			const { ctx } = makeContext({ order: [] });

			const { sent } = await call({ ctx, query });

			expect(sent.status).toBe(404);
			expect(JSON.parse(sent.body)).toEqual({ error: { message: "No such project." } });
			expect(ctx.hub.subscribe).not.toHaveBeenCalled();
			expect(ctx.statusPusher.push).not.toHaveBeenCalled();
		},
	);
});
