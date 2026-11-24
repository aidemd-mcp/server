import { describe, it, expect } from "vitest";
import { join, resolve, parse } from "node:path";
import normalizeProjectPath from "./index.js";

const projectRoot = resolve("/work/project");
const outside = join(parse(projectRoot).root, "elsewhere", "x");

describe("normalizeProjectPath", () => {
	it.each([
		["relative", "src/tools/score"],
		["trailing slash", "src/tools/score/"],
		["dot-slash prefix", "./src/tools/score"],
		["absolute", join(projectRoot, "src", "tools", "score")],
	])("normalizes the %s form to src/tools/score", (_name, path) => {
		expect(normalizeProjectPath({ projectRoot, path })).toBe("src/tools/score");
	});

	it.runIf(process.platform === "win32")("treats a differently-cased absolute path as the same folder on win32", () => {
		const path = join(projectRoot.toUpperCase(), "src", "tools", "score");
		expect(normalizeProjectPath({ projectRoot, path })).toBe("src/tools/score");
	});

	it("maps the project root itself to a dot", () => {
		expect(normalizeProjectPath({ projectRoot, path: projectRoot })).toBe(".");
		expect(normalizeProjectPath({ projectRoot, path: "." })).toBe(".");
		expect(normalizeProjectPath({ projectRoot, path: "./" })).toBe(".");
	});

	it("returns null for a path outside the project", () => {
		expect(normalizeProjectPath({ projectRoot, path: "../elsewhere" })).toBeNull();
		expect(normalizeProjectPath({ projectRoot, path: outside })).toBeNull();
	});

	it("keeps the file name of a file path", () => {
		expect(normalizeProjectPath({ projectRoot, path: "src/a/plan.aide" })).toBe("src/a/plan.aide");
	});

	it("does not treat a folder starting with two dots as outside", () => {
		expect(normalizeProjectPath({ projectRoot, path: "..hidden/file" })).toBe("..hidden/file");
	});
});
