import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import parseViewArgs from "./index.js";

const cwd = resolve("/project/root");

describe("parseViewArgs", () => {
	it("accepts a valid port", () => {
		expect(parseViewArgs({ args: ["--port", "41234"], cwd })).toEqual({ kind: "run", port: 41234 });
	});

	it("resolves a relative --kanban against cwd and keeps an absolute one", () => {
		expect(parseViewArgs({ args: ["--port", "41234", "--kanban", "../kanban"], cwd })).toEqual({
			kind: "run",
			port: 41234,
			kanbanPath: resolve(cwd, "../kanban"),
		});
		const absolute = resolve("/elsewhere/kanban");
		expect(parseViewArgs({ args: ["--kanban", absolute, "--port", "1"], cwd })).toEqual({
			kind: "run",
			port: 1,
			kanbanPath: absolute,
		});
	});

	it("treats --brain as a deprecated alias for <path>/kanban", () => {
		expect(parseViewArgs({ args: ["--brain", "brains/main"], cwd })).toEqual({
			kind: "run",
			kanbanPath: join(resolve(cwd, "brains/main"), "kanban"),
			deprecatedBrain: true,
		});
	});

	it("treats --port as optional: absent means a run with no port", () => {
		expect(parseViewArgs({ args: [], cwd })).toEqual({ kind: "run" });
		expect(parseViewArgs({ args: ["--kanban", "k"], cwd })).toEqual({
			kind: "run",
			kanbanPath: resolve(cwd, "k"),
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

	it.each([
		[["--port", "1", "--port", "2"], "--port was given more than once."],
		[["--kanban", "a", "--kanban", "b"], "--kanban was given more than once."],
		[["--brain", "a", "--brain", "b"], "--brain was given more than once."],
		[["--kanban", "a", "--brain", "b"], "--kanban and --brain cannot be used together."],
		[["--brain", "a", "--kanban", "b"], "--kanban and --brain cannot be used together."],
	])("rejects %j", (args, message) => {
		expect(parseViewArgs({ args, cwd })).toEqual({ kind: "invalid", message });
	});

	it("rejects --kanban and --brain with no value", () => {
		expect(parseViewArgs({ args: ["--kanban"], cwd })).toEqual({ kind: "invalid", message: "--kanban needs a value." });
		expect(parseViewArgs({ args: ["--brain"], cwd })).toEqual({ kind: "invalid", message: "--brain needs a value." });
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
