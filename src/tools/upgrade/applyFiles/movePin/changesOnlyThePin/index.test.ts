import { describe, it, expect } from "vitest";
import changesOnlyThePin from "./index.js";

const OLD = "@aidemd-mcp/server@0.12.0";
const NEW = "@aidemd-mcp/server@0.13.1";

function makeConfig({ spec = OLD, other = "x", extraArg = "-y" } = {}): string {
	return JSON.stringify({
		mcpServers: {
			aide: { command: "npx", args: [extraArg, spec] },
			other: { command: "node", args: [other] },
		},
	});
}

describe("changesOnlyThePin", () => {
	const before = makeConfig();

	it("is true for a correct splice", () => {
		expect(changesOnlyThePin({ before, after: makeConfig({ spec: NEW }), specIndex: 1, spec: NEW })).toBe(true);
	});

	it("is false when another server's value also changed", () => {
		const after = makeConfig({ spec: NEW, other: "y" });
		expect(changesOnlyThePin({ before, after, specIndex: 1, spec: NEW })).toBe(false);
	});

	it("is false when a different arg index changed", () => {
		const after = makeConfig({ extraArg: NEW });
		expect(changesOnlyThePin({ before, after, specIndex: 1, spec: NEW })).toBe(false);
	});

	it("is false when after is not valid JSON", () => {
		expect(changesOnlyThePin({ before, after: "{", specIndex: 1, spec: NEW })).toBe(false);
	});

	it("is false when before is not valid JSON", () => {
		expect(changesOnlyThePin({ before: "{", after: makeConfig({ spec: NEW }), specIndex: 1, spec: NEW })).toBe(false);
	});
});
