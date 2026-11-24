import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import locatePageAssets from "./index.js";

describe("locatePageAssets", () => {
	it("ends in dist/observer/assets", () => {
		expect(locatePageAssets().endsWith(["dist", "observer", "assets"].join(sep))).toBe(true);
	});

	it("sits under the package root that holds this package's package.json", () => {
		const packageRoot = dirname(dirname(dirname(locatePageAssets())));
		const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as { name: string };
		expect(manifest.name).toBe("@aidemd-mcp/server");
	});
});
