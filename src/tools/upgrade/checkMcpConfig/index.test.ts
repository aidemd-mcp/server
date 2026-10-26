import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import checkMcpConfig from "./index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";

const mockReadFile = readFile as Mock;

const MCP_PATH = "/project/.mcp.json";
const CANONICAL_ENTRY = mcpEntry("local");
const GLOBAL_ENTRY = mcpEntry("global");
const PATH_TIP =
	"The aide entry launches the global install by absolute path. A bare `aidemd-mcp` command is more portable if `.mcp.json` is committed.";

function configWith(entry: { command: unknown; args: unknown }, key = "aide"): string {
	return JSON.stringify({ mcpServers: { [key]: entry } }, null, 2) + "\n";
}

function canonical(): string {
	return configWith(CANONICAL_ENTRY);
}

function enoent(): NodeJS.ErrnoException {
	const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
	err.code = "ENOENT";
	return err;
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("checkMcpConfig", () => {
	describe("file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns status 'missing'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("missing");
		});

		it("returns category 'mcp'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.category).toBe("mcp");
		});

		it("includes prescription with key 'aide' and canonical entry", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});

		it("includes filePath", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.filePath).toBe(MCP_PATH);
		});
	});

	describe("file exists but is malformed JSON", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue("{ this is not json }");
		});

		it("returns status 'malformed'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("malformed");
		});

		it("does not include prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toBeUndefined();
		});

		it("does not include canonicalContent", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.canonicalContent).toBeUndefined();
		});
	});

	describe("file exists with canonical aide entry", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(canonical());
		});

		it("returns status 'matches'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
		});

		it("does not include prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toBeUndefined();
		});
	});

	describe("file exists with missing aide entry", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } }, null, 2) + "\n",
			);
		});

		it("returns status 'differs'", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
		});

		it("includes prescription", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("local npx entries are judged against the pinned canonical", () => {
		const spec = CANONICAL_ENTRY.args[CANONICAL_ENTRY.args.length - 1] as string;
		const pkg = spec.slice(0, spec.lastIndexOf("@"));
		const drifted: Array<[string, string[]]> = [
			["unpinned", ["-y", pkg]],
			["@latest", ["-y", `${pkg}@latest`]],
			["older pin", ["-y", `${pkg}@0.0.1`]],
			["current pin without -y", [spec]],
		];

		it("matches when pinned to the current version, with no prescription and no tip", async () => {
			mockReadFile.mockResolvedValue(canonical());
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});

		it.each(drifted)("differs for %s, prescribing local", async (_label, args) => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});

		it.each(drifted)("differs for %s wrapped in cmd /c, prescribing local", async (_label, args) => {
			mockReadFile.mockResolvedValue(configWith({ command: "cmd", args: ["/c", "npx", ...args] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("global aidemd-mcp entries", () => {
		it("matches the bare name with no tip", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});

		it("matches an absolute-path cmd shim and carries the tip", async () => {
			mockReadFile.mockResolvedValue(
				configWith({
					command: "cmd",
					args: ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"],
				}),
			);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBe(PATH_TIP);
		});

		it("matches a POSIX absolute path and carries the tip", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "/usr/local/bin/aidemd-mcp", args: [] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.tip).toBe(PATH_TIP);
		});

		it("differs with extra args, prescribing global", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "aidemd-mcp", args: ["--root", "x"] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
		});
	});

	describe("custom entries are left alone", () => {
		it.each([
			["dev form", { command: "node", args: ["dist/index.js"] }],
			["random command", { command: "my-wrapper", args: ["--serve"] }],
			["cmd /c wrapper of something else", { command: "cmd", args: ["/c", "run-aide.bat"] }],
			["malformed command", { command: 42, args: [] }],
		])("%s matches with no prescription and no tip", async (_label, entry) => {
			mockReadFile.mockResolvedValue(configWith(entry));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});
	});

	describe("file exists with legacy 'aidemd-mcp' key", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue(configWith(CANONICAL_ENTRY, "aidemd-mcp"));
		});

		it("returns status 'differs' (legacy key is detected as drift)", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
		});

		it("includes prescription so agent can migrate to 'aide' key", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
		});
	});

	describe("file exists with legacy 'aidemd-mcp' key holding a global entry", () => {
		it("differs, prescribing global", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY, "aidemd-mcp"));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
		});
	});

	describe("the brain entry is never judged", () => {
		const LEGACY_BRAIN = {
			command: "cmd",
			args: ["/c", "npx", "@bitbonsai/mcpvault", "C:\\vault"],
		};
		const GLOBAL_BRAIN = { command: "mcpvault", args: ["C:\\vault"] };

		function configWithBrain(aide: { command: unknown; args: unknown }, brain: { command: unknown; args: unknown }): string {
			return JSON.stringify({ mcpServers: { aide, brain } }, null, 2) + "\n";
		}

		it("matches with no prescription when a legacy brain launcher sits next to the canonical local aide entry", async () => {
			mockReadFile.mockResolvedValue(configWithBrain(CANONICAL_ENTRY, LEGACY_BRAIN));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
		});

		it("prescribes the aide key, never brain, when the aide entry has drifted", async () => {
			const spec = CANONICAL_ENTRY.args[CANONICAL_ENTRY.args.length - 1] as string;
			const pkg = spec.slice(0, spec.lastIndexOf("@"));
			mockReadFile.mockResolvedValue(configWithBrain({ command: "npx", args: ["-y", pkg] }, LEGACY_BRAIN));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription?.key).toBe("aide");
			expect(result.prescription?.key).not.toBe("brain");
		});

		it("matches with no prescription for a global mcpvault brain entry next to a canonical global aide entry", async () => {
			mockReadFile.mockResolvedValue(configWithBrain(GLOBAL_ENTRY, GLOBAL_BRAIN));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
		});
	});

	describe("with a target version", () => {
		const TARGET = "9.9.9";
		const UNLOCATABLE =
			"The aide entry runs npx in a form whose version pin cannot be located (another package, or a -p/--package flag), so it cannot be moved to 9.9.9. Leave the entry as it is and tell the user.";

		const wrap = (args: string[]) => ({ command: "cmd", args: ["/c", "npx", ...args] });
		const forms = (args: string[]) => [
			["direct", { command: "npx", args }],
			["cmd-wrapped", wrap(args)],
		] as const;

		describe("local entries behind the target", () => {
			it.each([
				["-y pinned old", ["-y", "@aidemd-mcp/server@0.0.1"], "0.0.1"],
				["-y bare", ["-y", "@aidemd-mcp/server"], null],
				["-y latest", ["-y", "@aidemd-mcp/server@latest"], "latest"],
				["no -y", ["@aidemd-mcp/server@0.0.1"], "0.0.1"],
			])("%s reports a pinMove and no prescription", async (_label, args, from) => {
				for (const [, entry] of forms(args)) {
					mockReadFile.mockResolvedValue(configWith(entry));
					const result = await checkMcpConfig(MCP_PATH, TARGET);
					expect(result.status).toBe("differs");
					expect(result.pinMove).toEqual({ from, to: TARGET });
					expect(result.prescription).toBeUndefined();
				}
			});
		});

		describe("local entries pinned at the target", () => {
			it.each([
				["with -y", ["-y", `@aidemd-mcp/server@${TARGET}`]],
				["without -y", [`@aidemd-mcp/server@${TARGET}`]],
			])("%s matches with no pinMove", async (_label, args) => {
				for (const [, entry] of forms(args)) {
					mockReadFile.mockResolvedValue(configWith(entry));
					const result = await checkMcpConfig(MCP_PATH, TARGET);
					expect(result.status).toBe("matches");
					expect(result.pinMove).toBeUndefined();
					expect(result.prescription).toBeUndefined();
				}
			});
		});

		it("matches a pin ahead of the target and does not move it", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args: ["-y", "@aidemd-mcp/server@99.0.0"] }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("matches");
			expect(result.pinMove).toBeUndefined();
		});

		it.each([
			["another package", ["-y", "aidemd-mcp"]],
			["a -p flag", ["-p", "@aidemd-mcp/server@0.0.1", "aidemd-mcp"]],
		])("reports instructions for an unlocatable pin (%s)", async (_label, args) => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.instructions).toBe(UNLOCATABLE);
			expect(result.prescription).toBeUndefined();
			expect(result.pinMove).toBeUndefined();
		});

		it("matches a bare global entry with no pinMove", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("matches");
			expect(result.pinMove).toBeUndefined();
			expect(result.tip).toBeUndefined();
		});

		it("carries the tip on an absolute-path cmd shim and reports no pinMove", async () => {
			mockReadFile.mockResolvedValue(
				configWith({ command: "cmd", args: ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\aidemd-mcp.cmd"] }),
			);
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("matches");
			expect(result.tip).toBe(PATH_TIP);
			expect(result.pinMove).toBeUndefined();
		});

		it("differs prescribing global for aidemd-mcp with extra args", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "aidemd-mcp", args: ["--root", "x"] }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.pinMove).toBeUndefined();
		});

		it("matches a custom entry with no pinMove", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "node", args: ["dist/index.js"] }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("matches");
			expect(result.pinMove).toBeUndefined();
		});

		it("keeps the local prescription when the file is missing", async () => {
			mockReadFile.mockRejectedValue(enoent());
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("missing");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
			expect(result.pinMove).toBeUndefined();
		});

		it("keeps the local prescription when the aide entry is missing", async () => {
			mockReadFile.mockResolvedValue(JSON.stringify({ mcpServers: {} }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: CANONICAL_ENTRY });
			expect(result.pinMove).toBeUndefined();
		});

		it("keeps the prescription for the legacy aidemd-mcp key", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args: ["-y", "@aidemd-mcp/server@0.0.1"] }, "aidemd-mcp"));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.prescription?.key).toBe("aide");
			expect(result.pinMove).toBeUndefined();
		});

		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(canonical());
			await checkMcpConfig(MCP_PATH, TARGET);
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});

	describe("no filesystem writes occur", () => {
		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(canonical());
			await checkMcpConfig(MCP_PATH);
			// readFile was called once; module does not import writeFile
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});
});
