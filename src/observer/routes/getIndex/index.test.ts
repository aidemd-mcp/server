import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";
import getIndex from "./index.js";

function makeInput({ ready, accept }: { ready: boolean; accept?: string }): { input: RouteInput; sent: { status: number; body: string; headers: Record<string, string> } } {
	const sent = { status: 0, body: "", headers: {} as Record<string, string> };
	const res = {
		writeHead: (status: number, headers: Record<string, string>) => {
			sent.status = status;
			sent.headers = headers;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const ctx = { version: "1.2.3", token: "tok123", store: { isReady: vi.fn(() => ready) } } as unknown as ObserverContext;
	return { input: { req: { headers: accept === undefined ? {} : { accept } } as RouteInput["req"], res, url: new URL("http://127.0.0.1/"), params: {}, ctx }, sent };
}

describe("getIndex", () => {
	it.each([true, false])("answers 200 with the marker and ready=%s", async (ready) => {
		const { input, sent } = makeInput({ ready });

		await getIndex(input);

		const body = JSON.parse(sent.body);
		expect(sent.status).toBe(200);
		expect(body.data.observer).toBe("aide-observer");
		expect(body.data.ready).toBe(ready);
		expect(body.data.version).toBe("1.2.3");
	});

	it("lists the seventeen routes with a purpose each, the per-project ones under /api/projects", async () => {
		const { input, sent } = makeInput({ ready: true });

		await getIndex(input);

		const { routes } = JSON.parse(sent.body).data as { routes: { method: string; path: string; purpose: string }[] };
		expect(routes).toHaveLength(17);
		expect(routes.every((route) => route.purpose.length > 0)).toBe(true);
		const listed = routes.map((route) => `${route.method} ${route.path}`);
		expect(listed).toContain("POST /api/events");
		expect(listed).toContain("POST /api/shutdown");
		expect(routes.find((route) => route.path === "/api/shutdown")?.purpose).toMatch(/local tools only/);
		expect(listed).toContain("GET /assets/<name>");
		expect(listed).toContain("GET /api/projects");
		expect(listed).toContain("GET /p/<project>/s/<session>");
		expect(listed).toContain("GET /api/projects/<project>/status");
		expect(listed.filter((route) => route.includes("/api/projects/"))).toHaveLength(9);
	});

	it.each([[undefined], ["*/*"], ["application/json"]])("answers the JSON with Vary: Accept when Accept is %s", async (accept) => {
		const { input, sent } = makeInput({ ready: true, accept });

		await getIndex(input);

		expect(sent.headers["Content-Type"]).toBe("application/json; charset=utf-8");
		expect(sent.headers.Vary).toBe("Accept");
		expect(JSON.parse(sent.body).data.observer).toBe("aide-observer");
	});

	it("answers the HTML shell with the page CSP and Vary: Accept when Accept lists text/html", async () => {
		const { input, sent } = makeInput({ ready: true, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" });

		await getIndex(input);

		expect(sent.status).toBe(200);
		expect(sent.headers["Content-Type"]).toBe("text/html; charset=utf-8");
		expect(sent.headers.Vary).toBe("Accept");
		expect(sent.headers["Content-Security-Policy"]).toContain("script-src 'self'");
		expect(sent.body).toContain('src="/assets/page.js"');
		expect(sent.body).not.toContain("tok123");
	});
});
