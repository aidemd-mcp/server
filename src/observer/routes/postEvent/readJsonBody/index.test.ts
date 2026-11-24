import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import readJsonBody from "./index.js";

function makeRequest(body: string | Buffer): IncomingMessage {
	return Readable.from([typeof body === "string" ? Buffer.from(body) : body]) as unknown as IncomingMessage;
}

function makeEmptyRequest(): IncomingMessage {
	return Readable.from([]) as unknown as IncomingMessage;
}

describe("readJsonBody", () => {
	it("parses valid JSON", async () => {
		expect(await readJsonBody({ req: makeRequest('{"a":1}'), limit: 100 })).toEqual({ kind: "ok", value: { a: 1 } });
	});

	it("reports malformed JSON with the parse message", async () => {
		const result = await readJsonBody({ req: makeRequest("{nope"), limit: 100 });
		expect(result.kind).toBe("malformed");
		expect((result as { reason: string }).reason.length).toBeGreaterThan(0);
	});

	it("treats an empty body as malformed", async () => {
		expect((await readJsonBody({ req: makeEmptyRequest(), limit: 100 })).kind).toBe("malformed");
	});

	it("accepts a body exactly at the limit", async () => {
		const body = JSON.stringify({ a: "x".repeat(10) });
		expect((await readJsonBody({ req: makeRequest(body), limit: Buffer.byteLength(body) })).kind).toBe("ok");
	});

	it("rejects a body one byte over the limit and drains the stream", async () => {
		const body = JSON.stringify({ a: "x".repeat(10) });
		const req = makeRequest(body);
		const result = await readJsonBody({ req, limit: Buffer.byteLength(body) - 1 });
		expect(result).toEqual({ kind: "too-large" });
		expect(req.readableEnded).toBe(true);
	});
});
