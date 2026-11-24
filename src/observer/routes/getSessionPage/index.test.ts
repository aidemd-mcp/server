import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";
import getSessionPage from "./index.js";

async function ask(): Promise<{ status: number; headers: Record<string, string>; body: string; storeRead: boolean }> {
	const sent = { status: 0, headers: {} as Record<string, string>, body: "" };
	const res = {
		writeHead: (status: number, headers: Record<string, string>) => {
			sent.status = status;
			sent.headers = headers;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const sessions = vi.fn(() => []);
	const ctx = { token: "tok123", store: { sessions } } as unknown as ObserverContext;
	await getSessionPage({ req: {} as RouteInput["req"], res, url: new URL("http://127.0.0.1/"), params: { project: "a-aaaaaa", session: "s1" }, ctx });
	return { ...sent, storeRead: sessions.mock.calls.length > 0 };
}

describe("getSessionPage", () => {
	it("answers 200 text/html with the shell, which echoes no token", async () => {
		const reply = await ask();

		expect(reply.status).toBe(200);
		expect(reply.headers["Content-Type"]).toBe("text/html; charset=utf-8");
		expect(reply.body.startsWith("<!doctype html>")).toBe(true);
		expect(reply.body).toContain('href="/assets/page.css"');
		expect(reply.body).toContain('src="/assets/page.js"');
		expect(reply.body).not.toContain("tok123");
	});

	it("sends the strict page CSP and the common security headers", async () => {
		const { headers } = await ask();

		expect(headers["Content-Security-Policy"]).toBe(
			"default-src 'none'; script-src 'self'; style-src 'self'; font-src data:; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
		);
		expect(headers["Cache-Control"]).toBe("no-store");
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
	});

	it("does not read the store", async () => {
		expect((await ask()).storeRead).toBe(false);
	});
});
