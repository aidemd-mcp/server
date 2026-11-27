import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import { parse, type ObserverRecord } from "@/service/observer/event/shared/observerRecord/index.js";

const VALID = { address: "http://127.0.0.1:4317", token: "abc", pid: 123, version: "0.15.0" };

/** The zod schema `parse` replaced, copied verbatim from git HEAD: the recorded rules. */
const reference = z
	.object({
		address: z.string().regex(/^http:\/\/127\.0\.0\.1:\d{1,5}$/),
		token: z.string().min(1),
		pid: z.number().int().min(1),
		version: z.string().min(1),
		port: z.number().int().min(1).max(65535).optional(),
	})
	.strict();

describe("observerRecord parse", () => {
	it("accepts a loopback record", () => {
		expect(parse(VALID)).not.toBeNull();
	});

	it("accepts a record with a port and keeps it", () => {
		expect(parse({ ...VALID, port: 4317 })?.port).toBe(4317);
	});

	it("accepts a record without a port (an older observer wrote it)", () => {
		const result = parse(VALID);
		expect(result).not.toBeNull();
		expect(result?.port).toBeUndefined();
		expect(result).not.toHaveProperty("port");
	});

	it("accepts a record with a version and keeps it", () => {
		expect(parse({ ...VALID, version: "0.15.0" })?.version).toBe("0.15.0");
	});

	it("returns a new object, not the input", () => {
		const input = { ...VALID };
		expect(parse(input)).not.toBe(input);
	});

	it.each([
		["a localhost address", { ...VALID, address: "http://localhost:4317" }],
		["a 0.0.0.0 address", { ...VALID, address: "http://0.0.0.0:4317" }],
		["an https address", { ...VALID, address: "https://127.0.0.1:4317" }],
		["an empty token", { ...VALID, token: "" }],
		["pid 0", { ...VALID, pid: 0 }],
		["no version", (({ version: _version, ...rest }) => rest)(VALID)],
		["an empty version", { ...VALID, version: "" }],
		["port 0", { ...VALID, port: 0 }],
		["port 65536", { ...VALID, port: 65536 }],
		["a fractional port", { ...VALID, port: 4317.5 }],
		["an extra key", { ...VALID, extra: true }],
	])("rejects %s", (_name, value) => {
		expect(parse(value)).toBeNull();
	});
});

describe("observerRecord parse agrees with the zod schema it replaced", () => {
	const proto = JSON.parse('{"__proto__": 1, "address": "http://127.0.0.1:4317", "token": "t", "pid": 1, "version": "v"}');

	it.each([
		["the minimal record", VALID],
		["a port", { ...VALID, port: 4317 }],
		["port undefined", { ...VALID, port: undefined }],
		["port 1", { ...VALID, port: 1 }],
		["port 65535", { ...VALID, port: 65535 }],
		["keys in another order", { port: 80, version: "v", pid: 5, token: "t", address: "http://127.0.0.1:80" }],
		["port 0", { ...VALID, port: 0 }],
		["port 65536", { ...VALID, port: 65536 }],
		["port 1.5", { ...VALID, port: 1.5 }],
		['port "80"', { ...VALID, port: "80" }],
		["port null", { ...VALID, port: null }],
		["pid 1", { ...VALID, pid: 1 }],
		["pid 0", { ...VALID, pid: 0 }],
		["pid -1", { ...VALID, pid: -1 }],
		["pid 1.5", { ...VALID, pid: 1.5 }],
		['pid "1"', { ...VALID, pid: "1" }],
		["pid NaN", { ...VALID, pid: Number.NaN }],
		["pid Infinity", { ...VALID, pid: Number.POSITIVE_INFINITY }],
		["an empty token", { ...VALID, token: "" }],
		["a numeric token", { ...VALID, token: 1 }],
		["an empty version", { ...VALID, version: "" }],
		["no token", { address: VALID.address, pid: 1, version: "v" }],
		["a localhost address", { ...VALID, address: "http://localhost:4317" }],
		["an https address", { ...VALID, address: "https://127.0.0.1:4317" }],
		["another IP", { ...VALID, address: "http://127.0.0.2:4317" }],
		["a trailing slash", { ...VALID, address: "http://127.0.0.1:4317/" }],
		["a trailing newline", { ...VALID, address: "http://127.0.0.1:4317\n" }],
		["6 port digits", { ...VALID, address: "http://127.0.0.1:123456" }],
		["no port digits", { ...VALID, address: "http://127.0.0.1:" }],
		["an extra key", { ...VALID, extra: true }],
		["a __proto__ key", proto],
		["null", null],
		["an array", [VALID]],
		["a string", "observer"],
		["a number", 1],
		["undefined", undefined],
	])("%s", (_name, value) => {
		const expected = reference.safeParse(value);
		const actual = parse(value);
		if (!expected.success) {
			expect(actual).toBeNull();
			return;
		}
		expect(actual).toEqual(expected.data);
		expect(JSON.stringify(actual)).toBe(JSON.stringify(expected.data));
	});

	it("has the type the zod schema inferred", () => {
		expectTypeOf<z.infer<typeof reference>>().toEqualTypeOf<ObserverRecord>();
	});
});
