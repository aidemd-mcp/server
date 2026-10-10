import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import resolveProjectRoot from "./index.js";

const ROOT = resolve("server-root");

describe("resolveProjectRoot", () => {
	it("returns root when path is absent", () => {
		expect(resolveProjectRoot(ROOT)).toBe(ROOT);
	});

	it("returns root when path is an empty string", () => {
		expect(resolveProjectRoot(ROOT, "")).toBe(ROOT);
	});

	it("joins a relative path onto root", () => {
		expect(resolveProjectRoot(ROOT, join("apps", "web"))).toBe(join(ROOT, "apps", "web"));
	});

	it("lets an absolute path win over root", () => {
		const absolute = resolve("elsewhere", "project");
		expect(resolveProjectRoot(ROOT, absolute)).toBe(absolute);
	});
});
