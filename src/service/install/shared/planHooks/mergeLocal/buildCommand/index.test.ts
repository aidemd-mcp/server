import { describe, it, expect } from "vitest";
import buildCommand from "./index.js";

describe("buildCommand", () => {
	it("quotes the entry and ends with the hook argument", () => {
		expect(buildCommand("C:/Users/me/AppData/Roaming/npm/node_modules/@aidemd-mcp/server/dist/index.js")).toBe(
			'node "C:/Users/me/AppData/Roaming/npm/node_modules/@aidemd-mcp/server/dist/index.js" hook',
		);
	});

	it("keeps a path with a space inside the quotes", () => {
		expect(buildCommand("C:/Program Files/nodejs/node_modules/@aidemd-mcp/server/dist/index.js")).toBe(
			'node "C:/Program Files/nodejs/node_modules/@aidemd-mcp/server/dist/index.js" hook',
		);
	});
});
