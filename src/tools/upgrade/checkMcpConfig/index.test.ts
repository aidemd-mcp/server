import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

vi.mock("@/service/install/shared/checkGlobalPackage/index.js", () => ({
	default: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import checkMcpConfig from "./index.js";
import aidePackage from "@/service/install/shared/aidePackage/index.js";
import { mcpEntry } from "@/service/install/wireMcp/index.js";

const mockReadFile = readFile as Mock;
const mockCheckGlobalPackage = checkGlobalPackage as Mock;

const MCP_PATH = "/project/.mcp.json";
const GLOBAL_ENTRY = mcpEntry();
const PATH_TIP =
	"The aide entry launches the global install by absolute path. A bare `aidemd-mcp` command is more portable if `.mcp.json` is committed.";
const LEGACY_KEY_PIN =
	"The aide entry is under the `aidemd-mcp` key, whose version pin this tool does not move. Call aide_upgrade without targetVersion to switch it to the global `aidemd-mcp` command instead.";
const PKG = aidePackage.name;

function globalPackage(installed: boolean) {
	return { name: PKG, installed, installCommand: aidePackage.installCommand };
}

function configWith(entry: { command: unknown; args: unknown }, key = "aide"): string {
	return JSON.stringify({ mcpServers: { [key]: entry } }, null, 2) + "\n";
}

function enoent(): NodeJS.ErrnoException {
	const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
	err.code = "ENOENT";
	return err;
}

beforeEach(() => {
	vi.resetAllMocks();
	mockCheckGlobalPackage.mockResolvedValue(false);
});

describe("checkMcpConfig", () => {
	describe("file does not exist", () => {
		beforeEach(() => {
			mockReadFile.mockRejectedValue(enoent());
		});

		it("returns status 'missing' with category 'mcp' and the filePath", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("missing");
			expect(result.category).toBe("mcp");
			expect(result.filePath).toBe(MCP_PATH);
		});

		it("prescribes the global entry under the 'aide' key", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.globalSwitch).toBeUndefined();
		});

		it.each([true, false])("reports globalPackage with installed %s", async (installed) => {
			mockCheckGlobalPackage.mockResolvedValue(installed);
			const result = await checkMcpConfig(MCP_PATH);
			expect(mockCheckGlobalPackage).toHaveBeenCalledWith(PKG);
			expect(result.globalPackage).toEqual(globalPackage(installed));
		});
	});

	describe("file exists but is malformed JSON", () => {
		beforeEach(() => {
			mockReadFile.mockResolvedValue("{ this is not json }");
		});

		it("returns status 'malformed' with no prescription, canonicalContent or npm check", async () => {
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("malformed");
			expect(result.prescription).toBeUndefined();
			expect(result.canonicalContent).toBeUndefined();
			expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
		});
	});

	describe("file exists with no aide entry", () => {
		it.each([
			["other server only", JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } })],
			["empty mcpServers", JSON.stringify({ mcpServers: {} })],
			["no mcpServers", JSON.stringify({})],
			["non-object aide entry", JSON.stringify({ mcpServers: { aide: "nope" } })],
		])("%s differs with a global prescription and globalPackage", async (_label, content) => {
			mockCheckGlobalPackage.mockResolvedValue(true);
			mockReadFile.mockResolvedValue(content);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.globalPackage).toEqual(globalPackage(true));
			expect(result.globalSwitch).toBeUndefined();
		});
	});

	describe("install-first instructions", () => {
		const INSTALL_FIRST = `The aide server is not installed globally. Run \`${aidePackage.installCommand}\` via Bash before merging this prescription. If the install fails, tell the user and do not merge the entry.`;

		const prescribed = [
			["missing file", "missing"],
			["config with no aide key", "differs"],
		] as const;

		function stage(label: string): void {
			if (label === "missing file") mockReadFile.mockRejectedValue(enoent());
			else mockReadFile.mockResolvedValue(JSON.stringify({ mcpServers: {} }));
		}

		it.each(prescribed)("%s tells the agent to install first when the package is missing", async (label, status) => {
			mockCheckGlobalPackage.mockResolvedValue(false);
			stage(label);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe(status);
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.instructions).toBe(INSTALL_FIRST);
		});

		it.each(prescribed)("%s carries no instructions when the package is installed", async (label, status) => {
			mockCheckGlobalPackage.mockResolvedValue(true);
			stage(label);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe(status);
			expect(result).not.toHaveProperty("instructions");
		});

		it("gives a non-canonical aidemd-mcp prescription no install instruction", async () => {
			mockCheckGlobalPackage.mockResolvedValue(false);
			mockReadFile.mockResolvedValue(configWith({ command: "aidemd-mcp", args: ["--root", "x"] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result).not.toHaveProperty("instructions");
		});

		it("gives an npx globalSwitch no install instruction", async () => {
			mockCheckGlobalPackage.mockResolvedValue(false);
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args: ["-y", PKG] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.globalSwitch).toBeDefined();
			expect(result).not.toHaveProperty("instructions");
		});
	});

	describe("npx entries are drift toward the global form", () => {
		const spec = `${PKG}@0.0.1`;
		const forms: Array<[string, string[]]> = [
			["pinned old", ["-y", spec]],
			["unpinned", ["-y", PKG]],
			["@latest", ["-y", `${PKG}@latest`]],
			["without -y", [spec]],
		];
		const entries = forms.flatMap(([label, args]) => [
			[`POSIX ${label}`, { command: "npx", args }] as const,
			[`cmd /c ${label}`, { command: "cmd", args: ["/c", "npx", ...args] }] as const,
		]);

		it.each(entries)("%s under 'aide' reports a globalSwitch and no prescription", async (_label, entry) => {
			mockCheckGlobalPackage.mockResolvedValue(true);
			mockReadFile.mockResolvedValue(configWith(entry));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.globalSwitch).toEqual({ key: "aide", ...globalPackage(true) });
			expect(result.prescription).toBeUndefined();
			expect(result.pinMove).toBeUndefined();
		});

		it.each(entries)("%s under 'aidemd-mcp' reports globalSwitch.key 'aidemd-mcp'", async (_label, entry) => {
			mockReadFile.mockResolvedValue(configWith(entry, "aidemd-mcp"));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.globalSwitch?.key).toBe("aidemd-mcp");
			expect(result.prescription).toBeUndefined();
		});

		it.each([true, false])("globalSwitch.installed mirrors the npm check (%s)", async (installed) => {
			mockCheckGlobalPackage.mockResolvedValue(installed);
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args: ["-y", spec] }));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.globalSwitch).toEqual({ key: "aide", ...globalPackage(installed) });
		});

		it("prefers the 'aide' key when both keys exist", async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					mcpServers: {
						"aidemd-mcp": GLOBAL_ENTRY,
						aide: { command: "npx", args: ["-y", spec] },
					},
				}),
			);
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.globalSwitch?.key).toBe("aide");
		});
	});

	describe("global aidemd-mcp entries", () => {
		it.each(["aide", "aidemd-mcp"])("a canonical entry under '%s' matches without the npm check", async (key) => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY, key));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
			expect(result.globalSwitch).toBeUndefined();
			expect(result.tip).toBeUndefined();
			expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
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
			expect(result.globalSwitch).toBeUndefined();
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
			expect(result.globalSwitch).toBeUndefined();
			expect(result.tip).toBeUndefined();
			expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
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

		it("matches with no prescription when a legacy brain launcher sits next to the global aide entry", async () => {
			mockReadFile.mockResolvedValue(configWithBrain(GLOBAL_ENTRY, LEGACY_BRAIN));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("matches");
			expect(result.prescription).toBeUndefined();
		});

		it("switches the aide key, never brain, when the aide entry is npx", async () => {
			mockReadFile.mockResolvedValue(configWithBrain({ command: "npx", args: ["-y", PKG] }, LEGACY_BRAIN));
			const result = await checkMcpConfig(MCP_PATH);
			expect(result.status).toBe("differs");
			expect(result.globalSwitch?.key).toBe("aide");
			expect(result.prescription).toBeUndefined();
		});

		it("matches with no prescription for a global mcpvault brain entry next to a global aide entry", async () => {
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

		describe("npx entries behind the target", () => {
			it.each([
				["-y pinned old", ["-y", "@aidemd-mcp/server@0.0.1"], "0.0.1"],
				["-y bare", ["-y", "@aidemd-mcp/server"], null],
				["-y latest", ["-y", "@aidemd-mcp/server@latest"], "latest"],
				["no -y", ["@aidemd-mcp/server@0.0.1"], "0.0.1"],
			])("%s reports a pinMove and no prescription or globalSwitch", async (_label, args, from) => {
				for (const [, entry] of forms(args)) {
					mockReadFile.mockResolvedValue(configWith(entry));
					const result = await checkMcpConfig(MCP_PATH, TARGET);
					expect(result.status).toBe("differs");
					expect(result.pinMove).toEqual({ from, to: TARGET });
					expect(result.prescription).toBeUndefined();
					expect(result.globalSwitch).toBeUndefined();
				}
			});
		});

		describe("npx entries pinned at the target", () => {
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

		it("keeps the global prescription when the file is missing", async () => {
			mockReadFile.mockRejectedValue(enoent());
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("missing");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.globalPackage).toEqual(globalPackage(false));
			expect(result.pinMove).toBeUndefined();
		});

		it("keeps the global prescription when the aide entry is missing", async () => {
			mockReadFile.mockResolvedValue(JSON.stringify({ mcpServers: {} }));
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.prescription).toEqual({ key: "aide", entry: GLOBAL_ENTRY });
			expect(result.pinMove).toBeUndefined();
		});

		it("reports LEGACY_KEY_PIN for an npx entry under the aidemd-mcp key, with no pinMove", async () => {
			mockReadFile.mockResolvedValue(
				configWith({ command: "npx", args: ["-y", "@aidemd-mcp/server@0.0.1"] }, "aidemd-mcp"),
			);
			const result = await checkMcpConfig(MCP_PATH, TARGET);
			expect(result.status).toBe("differs");
			expect(result.instructions).toBe(LEGACY_KEY_PIN);
			expect(result.pinMove).toBeUndefined();
			expect(result.prescription).toBeUndefined();
			expect(result.globalSwitch).toBeUndefined();
		});

		it("does not run the npm check for an npx entry with a target", async () => {
			mockReadFile.mockResolvedValue(configWith({ command: "npx", args: ["-y", "@aidemd-mcp/server@0.0.1"] }));
			await checkMcpConfig(MCP_PATH, TARGET);
			expect(mockCheckGlobalPackage).not.toHaveBeenCalled();
		});

		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY));
			await checkMcpConfig(MCP_PATH, TARGET);
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});

	describe("no filesystem writes occur", () => {
		it("never writes to disk", async () => {
			mockReadFile.mockResolvedValue(configWith(GLOBAL_ENTRY));
			await checkMcpConfig(MCP_PATH);
			// readFile was called once; module does not import writeFile
			expect(mockReadFile).toHaveBeenCalledOnce();
		});
	});
});
