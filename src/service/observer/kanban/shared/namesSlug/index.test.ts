import { describe, expect, it } from "vitest";
import namesSlug from "./index.js";

describe("namesSlug", () => {
	it.each([
		["`fix-login-bug` (Todo)", "fix-login-bug", true],
		["`fix-login-bug` (Todo)", "fix-login", false],
		["`fix-login-bug` (Todo)", "login-bug", false],
		["fix-login", "fix-login", true],
		["fix-login and more", "fix-login", true],
		["and more fix-login", "fix-login", true],
		["axb", "a.b", false],
		["see a.b here", "a.b", true],
		["", "fix-login", false],
	])("text %j, slug %j -> %s", (text, slug, expected) => {
		expect(namesSlug({ text, slug })).toBe(expected);
	});
});
