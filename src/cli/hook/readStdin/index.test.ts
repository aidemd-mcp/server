import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import readStdin from "./index.js";

describe("readStdin", () => {
	it("collects the stream as UTF-8 text", async () => {
		const stream = Readable.from([Buffer.from("héllo "), Buffer.from("wörld")]);
		expect(await readStdin({ stream, limit: 1024 })).toBe("héllo wörld");
	});

	it("resolves null past the limit and keeps draining", async () => {
		const stream = new PassThrough();
		const result = readStdin({ stream, limit: 4 });
		stream.write("abc");
		stream.write("defg");
		stream.end("hij");
		expect(await result).toBeNull();
		expect(stream.readableEnded).toBe(true);
	});

	it("accepts text exactly at the limit", async () => {
		expect(await readStdin({ stream: Readable.from(["abcd"]), limit: 4 })).toBe("abcd");
	});

	it("resolves null on a stream error", async () => {
		const stream = new PassThrough();
		const result = readStdin({ stream, limit: 10 });
		stream.destroy(new Error("boom"));
		expect(await result).toBeNull();
	});
});
