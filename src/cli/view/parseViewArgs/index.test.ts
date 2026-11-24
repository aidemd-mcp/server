import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import parseViewArgs from "./index.js";

const cwd = resolve("/project/root");

describe("parseViewArgs", () => {
	it("accepts a valid port", () => {
		expect(parseViewArgs({ args: ["--port", "41234"], cwd })).toEqual({ kind: "run", port: 41234 });
	});

	it("resolves a relative brain against cwd and keeps an absolute one", () => {
		expect(parseViewArgs({ args: ["--port", "41234", "--brain", "../brain"], cwd })).toEqual({
			kind: "run",
			port: 41234,
			brainPath: resolve(cwd, "../brain"),
		});
		const absolute = resolve("/elsewhere/brain");
		expect(parseViewArgs({ args: ["--brain", absolute, "--port", "1"], cwd })).toEqual({
			kind: "run",
			port: 1,
			brainPath: absolute,
		});
	});

	it("treats --port as optional: absent means a run with no port", () => {
		expect(parseViewArgs({ args: [], cwd })).toEqual({ kind: "run" });
		expect(parseViewArgs({ args: ["--brain", "b"], cwd })).toEqual({
			kind: "run",
			brainPath: resolve(cwd, "b"),
		});
	});

	it("reads --port 31000 as 31000", () => {
		expect(parseViewArgs({ args: ["--port", "31000"], cwd })).toEqual({ kind: "run", port: 31000 });
	});

	it("rejects --port with no value", () => {
		expect(parseViewArgs({ args: ["--port"], cwd })).toEqual({
			kind: "invalid",
			message: "--port needs a value.",
		});
	});

	it.each(["abc", "0", "70000", "65536", "12.5", "-1"])("rejects --port %s", (value) => {
		const result = parseViewArgs({ args: ["--port", value], cwd });
		expect(result).toMatchObject({ kind: "invalid" });
		expect(result.kind === "invalid" && result.message).toContain(value);
	});

	it("accepts the port bounds", () => {
		expect(parseViewArgs({ args: ["--port", "65535"], cwd })).toEqual({ kind: "run", port: 65535 });
	});

	it("rejects a duplicate --port and a duplicate --brain", () => {
		expect(parseViewArgs({ args: ["--port", "1", "--port", "2"], cwd })).toMatchObject({ kind: "invalid" });
		expect(parseViewArgs({ args: ["--port", "1", "--brain", "a", "--brain", "b"], cwd })).toMatchObject({
			kind: "invalid",
		});
	});

	it("rejects an unknown flag and a stray positional, naming it", () => {
		const flag = parseViewArgs({ args: ["--host", "x", "--port", "1"], cwd });
		expect(flag.kind === "invalid" && flag.message).toContain("--host");
		const positional = parseViewArgs({ args: ["--port", "1", "extra"], cwd });
		expect(positional.kind === "invalid" && positional.message).toContain("extra");
	});

	it("lets --help win anywhere", () => {
		expect(parseViewArgs({ args: ["--port", "abc", "--help"], cwd })).toEqual({ kind: "help" });
		expect(parseViewArgs({ args: ["--help", "--bogus"], cwd })).toEqual({ kind: "help" });
	});
});
