import { describe, it, expect } from "vitest";
import aidePackage from "./index.js";

describe("aidePackage", () => {
	it("pins the package name", () => {
		expect(aidePackage.name).toBe("@aidemd-mcp/server");
	});

	it("pins the global bin command", () => {
		expect(aidePackage.command).toBe("aidemd-mcp");
	});

	it("pins the global install command", () => {
		expect(aidePackage.installCommand).toBe("npm i -g @aidemd-mcp/server");
	});

	it("builds installCommand from the package name", () => {
		expect(aidePackage.installCommand).toBe("npm i -g " + aidePackage.name);
	});
});
