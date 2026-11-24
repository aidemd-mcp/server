import { describe, expect, it } from "vitest";
import parsePort from "./index.js";

describe("parsePort", () => {
	it.each(["1", "24680", "65535"])("accepts %s", (value) => {
		expect(parsePort({ value, source: "--port", shown: value })).toEqual({ ok: true, port: Number(value) });
	});

	it.each(["", "0", "65536", "1.5", "-1", "abc", " 80 x"])("refuses %j naming the source and shown value", (value) => {
		expect(parsePort({ value, source: "--port", shown: `"${value}"` })).toEqual({
			ok: false,
			reason: `--port must be an integer from 1 to 65535; got "${value}".`,
		});
	});
});
