import { describe, it, expect } from "vitest";
import changesOnlyTheLaunch from "./index.js";

const before = JSON.stringify({
	mcpServers: {
		aide: { command: "npx", args: ["-y", "@aidemd-mcp/server"], env: { A: "1" } },
		other: { command: "npx", args: ["-y", "@aidemd-mcp/server"] },
	},
});

function afterWith(mutate: (config: any) => void): string {
	const config = JSON.parse(before);
	config.mcpServers.aide.command = "aidemd-mcp";
	config.mcpServers.aide.args = [];
	mutate(config);
	return JSON.stringify(config);
}

describe("changesOnlyTheLaunch", () => {
	it("is true when only command and args changed on the key", () => {
		expect(changesOnlyTheLaunch({ before, after: afterWith(() => {}), key: "aide" })).toBe(true);
	});

	it("is false when another field of the entry changed", () => {
		const after = afterWith((c) => delete c.mcpServers.aide.env);
		expect(changesOnlyTheLaunch({ before, after, key: "aide" })).toBe(false);
	});

	it("is false when another server changed", () => {
		const after = afterWith((c) => (c.mcpServers.other.args = []));
		expect(changesOnlyTheLaunch({ before, after, key: "aide" })).toBe(false);
	});

	it("is false when the command is not the global command", () => {
		const after = afterWith((c) => (c.mcpServers.aide.command = "node"));
		expect(changesOnlyTheLaunch({ before, after, key: "aide" })).toBe(false);
	});

	it("is false when the key was renamed", () => {
		const after = afterWith((c) => {
			c.mcpServers["aidemd-mcp"] = c.mcpServers.aide;
			delete c.mcpServers.aide;
		});
		expect(changesOnlyTheLaunch({ before, after, key: "aide" })).toBe(false);
	});

	it("is false when the key is absent from the old config", () => {
		expect(changesOnlyTheLaunch({ before, after: before, key: "aidemd-mcp" })).toBe(false);
	});

	it.each([
		["after", before, "{"],
		["before", "{", before],
	])("is false when %s is unparseable", (_name, b, a) => {
		expect(changesOnlyTheLaunch({ before: b, after: a, key: "aide" })).toBe(false);
	});
});
