import { describe, it, expect } from "vitest";
import hashBytes from "./index.js";

describe("hashBytes", () => {
	it("matches the known SHA-256 vector for 'abc'", () => {
		expect(hashBytes("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	});

	it("returns 64 lowercase hex characters", () => {
		expect(hashBytes("anything")).toMatch(/^[0-9a-f]{64}$/);
	});

	it("hashes CRLF and LF text differently", () => {
		expect(hashBytes("a\r\n")).not.toBe(hashBytes("a\n"));
	});

	it("changes the hash when a trailing space is added", () => {
		expect(hashBytes("a ")).not.toBe(hashBytes("a"));
	});

	it("hashes the UTF-8 encoding of the string", () => {
		expect(hashBytes("é")).toBe("4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c");
	});
});
