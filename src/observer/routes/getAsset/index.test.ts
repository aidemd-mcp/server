import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteInput } from "../../types/index.js";

const assetsFolder = vi.hoisted(() => ({ path: "" }));
vi.mock("../../locatePageAssets/index.js", () => ({ default: () => assetsFolder.path }));

import getAsset from "./index.js";

const workDir = mkdtempSync(join(tmpdir(), "aide-getasset-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

function makeInput({ name }: { name: string }) {
	const sent: { status: number; headers: Record<string, string>; body: string } = { status: 0, headers: {}, body: "" };
	const res = {
		writeHead: (status: number, headers: Record<string, string>) => {
			sent.status = status;
			sent.headers = headers;
		},
		end: (body: string | Buffer) => {
			sent.body = body.toString();
		},
	} as unknown as ServerResponse;
	const input = { req: {} as RouteInput["req"], res, url: new URL("http://127.0.0.1/"), params: { name }, ctx: {} as RouteInput["ctx"] } satisfies RouteInput;
	return { input, sent };
}

describe("getAsset", () => {
	beforeEach(() => {
		assetsFolder.path = join(workDir, "assets");
		rmSync(assetsFolder.path, { recursive: true, force: true });
		mkdirSync(assetsFolder.path, { recursive: true });
		writeFileSync(join(assetsFolder.path, "page.js"), "console.log(1)");
		writeFileSync(join(assetsFolder.path, "page.css"), "body{}");
		writeFileSync(join(assetsFolder.path, "index.html"), "<p>secret</p>");
		writeFileSync(join(assetsFolder.path, "page.js.map"), "{}");
	});

	it.each([
		{ name: "page.js", contentType: "text/javascript; charset=utf-8", body: "console.log(1)" },
		{ name: "page.css", contentType: "text/css; charset=utf-8", body: "body{}" },
	])("serves $name with its content type and nosniff", async ({ name, contentType, body }) => {
		const { input, sent } = makeInput({ name });

		await getAsset(input);

		expect(sent.status).toBe(200);
		expect(sent.headers["Content-Type"]).toBe(contentType);
		expect(sent.headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(sent.body).toBe(body);
	});

	it.each(["index.html", "../package.json", "..%2Fpackage.json", "page.js.map", "toString", "__proto__", ""])("answers 404 for %s", async (name) => {
		const { input, sent } = makeInput({ name });

		await getAsset(input);

		expect(sent.status).toBe(404);
		expect(JSON.parse(sent.body)).toEqual({ error: { message: "No such asset." } });
	});

	it("answers 503 naming the build command when the bundle folder is missing", async () => {
		assetsFolder.path = join(workDir, "not-built");
		const { input, sent } = makeInput({ name: "page.js" });

		await getAsset(input);

		expect(sent.status).toBe(503);
		expect(JSON.parse(sent.body).error.message).toBe("The observer page has not been built; run npm run build.");
	});

	it("throws a read error that is not a missing file", async () => {
		// A folder in place of the file makes readFile fail with EISDIR, not ENOENT.
		rmSync(join(assetsFolder.path, "page.css"));
		mkdirSync(join(assetsFolder.path, "page.css"));
		const { input } = makeInput({ name: "page.css" });

		await expect(getAsset(input)).rejects.toThrow();
	});
});
