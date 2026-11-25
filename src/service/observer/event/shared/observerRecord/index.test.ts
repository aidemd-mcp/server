import { describe, it, expect } from "vitest";
import { schema } from "@/service/observer/event/shared/observerRecord/index.js";

const VALID = { address: "http://127.0.0.1:4317", token: "abc", pid: 123, version: "0.15.0" };

describe("observerRecord schema", () => {
	it("accepts a loopback record", () => {
		expect(schema.safeParse(VALID).success).toBe(true);
	});

	it("accepts a record with a port and keeps it", () => {
		const result = schema.safeParse({ ...VALID, port: 4317 });
		expect(result.success).toBe(true);
		expect(result.data?.port).toBe(4317);
	});

	it("accepts a record without a port (an older observer wrote it)", () => {
		const result = schema.safeParse(VALID);
		expect(result.success).toBe(true);
		expect(result.data?.port).toBeUndefined();
	});

	it("accepts a record with a version and keeps it", () => {
		const result = schema.safeParse({ ...VALID, version: "0.15.0" });
		expect(result.success).toBe(true);
		expect(result.data?.version).toBe("0.15.0");
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
		expect(schema.safeParse(value).success).toBe(false);
	});
});
