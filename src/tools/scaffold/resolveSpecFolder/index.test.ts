import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import resolveSpecFolder from "./index.js";

const root = join(tmpdir(), "aide-resolve-spec-folder-project");

describe("resolveSpecFolder", () => {
	it.each([
		["."],
		[""],
		["./"],
		[".aide"],
		["./.aide"],
		[".aide/"],
		[root],
		[join(root, ".aide")],
	])("treats %j as the project's .aide folder", (directory) => {
		const result = resolveSpecFolder({ root, directory });

		expect(result.holdsRootSpec).toBe(true);
		expect(result.folder).toBe(join(root, ".aide"));
	});

	it.each([
		["src/tools/x", resolve(root, "src/tools/x")],
		[".aide/docs", resolve(root, ".aide/docs")],
		["src/.aide", resolve(root, "src/.aide")],
		[
			join(tmpdir(), "aide-resolve-spec-folder-elsewhere"),
			resolve(tmpdir(), "aide-resolve-spec-folder-elsewhere"),
		],
	])("treats %j as a module folder", (directory, expected) => {
		const result = resolveSpecFolder({ root, directory });

		expect(result.holdsRootSpec).toBe(false);
		expect(result.folder).toBe(expected);
	});

	it.runIf(process.platform === "win32")(
		"matches the project's .aide folder case-insensitively on Windows",
		() => {
			const result = resolveSpecFolder({
				root: root.toUpperCase(),
				directory: ".AIDE",
			});

			expect(result.holdsRootSpec).toBe(true);
			expect(result.folder).toBe(join(root.toUpperCase(), ".aide"));
		},
	);
});
