import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The entry runs at import time, so every test sets argv, resets the module
// registry and imports it fresh. The flags flip when a factory is evaluated.
const { mockRunCli, mockStartServer, loaded } = vi.hoisted(() => ({
	mockRunCli: vi.fn(),
	mockStartServer: vi.fn(async () => {}),
	loaded: { startServer: false, sdk: false },
}));

vi.mock("@/cli/index.js", () => ({ default: mockRunCli }));
vi.mock("./startServer/index.js", () => {
	loaded.startServer = true;
	return { default: mockStartServer };
});
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
	loaded.sdk = true;
	return { Server: vi.fn() };
});

const originalArgv = process.argv;

beforeEach(() => {
	loaded.startServer = false;
	loaded.sdk = false;
	vi.resetModules();
});

afterEach(() => {
	process.argv = originalArgv;
	vi.clearAllMocks();
});

async function runEntry(args: string[], handled: boolean): Promise<void> {
	process.argv = ["node", "dist/index.js", ...args];
	mockRunCli.mockResolvedValue(handled);
	await import("./index.js");
}

describe("entry routing", () => {
	it.each([["init"], ["sync"], ["view", "--port", "41234"]])(
		"hands `%s` to runCli with argv.slice(2) and never loads startServer or the SDK",
		async (...args) => {
			await runEntry(args, true);

			expect(mockRunCli).toHaveBeenCalledWith(args);
			expect(loaded.startServer).toBe(false);
			expect(loaded.sdk).toBe(false);
			expect(mockStartServer).not.toHaveBeenCalled();
		},
	);

	it.each([[[]], [["--root", "/some/path"]]])(
		"starts the server once when runCli returns false for argv %j",
		async (args) => {
			await runEntry(args, false);

			expect(mockRunCli).toHaveBeenCalledWith(args);
			expect(mockStartServer).toHaveBeenCalledTimes(1);
		},
	);
});

describe("remediation names the project's own launcher", () => {
	const NPX_ONLY_REMEDIATION = /run `npx @aidemd-mcp\/server@latest (sync|init)`/i;
	const LATEST_LAUNCHER = "@aidemd-mcp/server@latest";
	const srcRoot = dirname(fileURLToPath(import.meta.url));

	function findOffendingLines(): string[] {
		const files = (readdirSync(srcRoot, { recursive: true }) as string[])
			.filter((rel) => rel.endsWith(".ts") && !rel.endsWith(".test.ts"));
		const offenders: string[] = [];
		for (const rel of files) {
			const lines = readFileSync(join(srcRoot, rel), "utf-8").split(/\r?\n/);
			lines.forEach((line, index) => {
				const trimmed = line.trimStart();
				if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
				if (line.includes(LATEST_LAUNCHER)) offenders.push(`${rel}:${index + 1}`);
			});
		}
		return offenders;
	}

	it("has no non-test, non-comment source line that mentions @aidemd-mcp/server@latest", () => {
		expect(findOffendingLines()).toEqual([]);
	});

	it("the guard substring matches a bare usage line", () => {
		expect("Usage: npx @aidemd-mcp/server@latest sync".includes(LATEST_LAUNCHER)).toBe(true);
	});

	it("the guard regex matches the old hardcoded remediation literal", () => {
		expect(NPX_ONLY_REMEDIATION.test("Run `npx @aidemd-mcp/server@latest init` to scaffold it")).toBe(true);
	});
});
