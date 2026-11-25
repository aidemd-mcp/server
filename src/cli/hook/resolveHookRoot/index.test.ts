import { describe, expect, it } from "vitest";
import resolveHookRoot from "./index.js";

describe("resolveHookRoot", () => {
	it.each([
		["CLAUDE_PROJECT_DIR wins over cwd", { CLAUDE_PROJECT_DIR: "/env" }, "/cwd", "/env"],
		["cwd when CLAUDE_PROJECT_DIR is unset", {}, "/cwd", "/cwd"],
		["cwd when CLAUDE_PROJECT_DIR is blank", { CLAUDE_PROJECT_DIR: "  " }, "/cwd", "/cwd"],
		["CLAUDE_PROJECT_DIR when cwd is absent", { CLAUDE_PROJECT_DIR: "/env" }, undefined, "/env"],
		["null when neither is usable", {}, undefined, null],
		["null when cwd is blank", {}, " ", null],
	])("%s", (_label, env, cwd, expected) => {
		expect(resolveHookRoot({ env: env as NodeJS.ProcessEnv, cwd })).toBe(expected);
	});
});
