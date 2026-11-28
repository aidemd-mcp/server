import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import renderReadme from "./renderReadme/index.js";

// Drift check: the committed README must equal what the generator would write.
// Imports renderReadme only — never the CLI, which writes the file on import.
describe("README tools section", () => {
	it("matches what the generator would write", () => {
		const readmePath = fileURLToPath(new URL("../../README.md", import.meta.url));
		const readme = readFileSync(readmePath, "utf8");

		expect(
			renderReadme({ readme }) === readme,
			"README tools section is stale: run npm run build:readme and commit README.md",
		).toBe(true);
	});
});
