import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, access, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import applySteps from "./index.js";
import type { InitStep } from "@/types/index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-apply-steps-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Check if a path exists on disk. */
async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

describe("applySteps", () => {
	it("would-create file step: file is written to disk", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "would-create",
			category: "methodology",
			filePath,
			content: "# AIDE\n\npointer content\n",
		};

		await applySteps([step]);

		const written = await readFile(filePath, "utf-8");
		expect(written).toBe("# AIDE\n\npointer content\n");
	});

	it("would-create file step: returned step has status created and no content field", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "would-create",
			category: "methodology",
			filePath,
			content: "# AIDE\n",
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("created");
		expect(result).not.toHaveProperty("content");
	});

	it("would-create brain vault step: directories in content JSON are created under filePath", async () => {
		const brainPath = join(tempDir, "vault");
		const dirs = ["research", "process/retro", "coding-playbook"];
		const step: InitStep = {
			name: "Brain vault",
			status: "would-create",
			category: "brain",
			filePath: brainPath,
			content: JSON.stringify(dirs),
		};

		await applySteps([step]);

		for (const dir of dirs) {
			expect(await pathExists(join(brainPath, dir))).toBe(true);
		}
	});

	it("would-create brain vault step: returned step has status created and no content field", async () => {
		const brainPath = join(tempDir, "vault");
		const step: InitStep = {
			name: "Brain vault",
			status: "would-create",
			category: "brain",
			filePath: brainPath,
			content: JSON.stringify(["research"]),
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("created");
		expect(result).not.toHaveProperty("content");
	});

	it("exists step: passes through unchanged, nothing written", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "exists",
			category: "methodology",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("would-skip step: passes through unchanged", async () => {
		const filePath = join(tempDir, "settings.json");
		const step: InitStep = {
			name: "Zed config",
			status: "would-skip",
			category: "ide",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("MCP prescription step: passes through unchanged, prescription preserved, nothing written", async () => {
		const filePath = join(tempDir, ".mcp.json");
		const prescription = {
			key: "aide",
			entry: { command: "npx", args: ["@aidemd-mcp/server"] },
		};
		const step: InitStep = {
			name: "MCP config (aide)",
			status: "would-create",
			category: "mcp",
			filePath,
			prescription,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(result.prescription).toEqual(prescription);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("obsidian MCP placeholder step (no prescription, no content, category mcp): passes through unchanged, nothing written", async () => {
		const filePath = join(tempDir, ".mcp.json");
		const step: InitStep = {
			name: "MCP config (obsidian)",
			status: "would-create",
			category: "mcp",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("IDE VS Code step: passes through without writing to disk", async () => {
		const filePath = join(tempDir, "aide-markdown.vsix");
		const step: InitStep = {
			name: "VS Code extension",
			status: "would-create",
			category: "ide",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("would-create");
		expect(result.category).toBe("ide");
		expect(result.filePath).toBe(filePath);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("IDE VS Code step: instructions field is set to the code --install-extension command", async () => {
		const filePath = join(tempDir, "aide-markdown.vsix");
		const step: InitStep = {
			name: "VS Code extension",
			status: "would-create",
			category: "ide",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result.instructions).toBe(`code --install-extension ${filePath}`);
	});

	it("parent directory creation: deeply nested path creates all intermediate dirs", async () => {
		const filePath = join(tempDir, "a", "b", "c", "d", "file.md");
		const step: InitStep = {
			name: "Deep file",
			status: "would-create",
			category: "commands",
			filePath,
			content: "deep content\n",
		};

		await applySteps([step]);

		const written = await readFile(filePath, "utf-8");
		expect(written).toBe("deep content\n");
	});

	it("idempotency: applying the same steps twice does not fail", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "would-create",
			category: "methodology",
			filePath,
			content: "# AIDE\n",
		};

		await applySteps([step]);
		// Second apply with same input — overwriting should not throw
		await expect(applySteps([step])).resolves.not.toThrow();
	});

	it("idempotency: applying brain vault twice does not fail", async () => {
		const brainPath = join(tempDir, "vault");
		const step: InitStep = {
			name: "Brain vault",
			status: "would-create",
			category: "brain",
			filePath: brainPath,
			content: JSON.stringify(["research", "process/retro"]),
		};

		await applySteps([step]);
		await expect(applySteps([step])).resolves.not.toThrow();
	});

	it("brain placeholder (empty filePath, no content): passes through unchanged", async () => {
		const step: InitStep = {
			name: "Brain vault",
			status: "would-create",
			category: "brain",
			filePath: "",
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
	});

	it("mixed steps: only would-create file steps are written, others pass through", async () => {
		const commandFile = join(tempDir, ".claude", "commands", "aide", "research.md");
		const mcpFile = join(tempDir, ".mcp.json");

		const steps: InitStep[] = [
			{
				name: "aide:research",
				status: "would-create",
				category: "commands",
				filePath: commandFile,
				content: "# research command\n",
			},
			{
				name: "MCP config (aide)",
				status: "would-create",
				category: "mcp",
				filePath: mcpFile,
				prescription: { key: "aide", entry: { command: "npx", args: ["aidemd-mcp"] } },
			},
			{
				name: "Zed config",
				status: "exists",
				category: "ide",
				filePath: join(tempDir, ".zed", "settings.json"),
			},
		];

		const results = await applySteps(steps);

		// Command file written, status created
		expect(results[0].status).toBe("created");
		expect(results[0]).not.toHaveProperty("content");
		expect(await pathExists(commandFile)).toBe(true);

		// MCP step unchanged — prescription preserved
		expect(results[1]).toEqual(steps[1]);
		expect(await pathExists(mcpFile)).toBe(false);

		// Exists step unchanged
		expect(results[2]).toEqual(steps[2]);
	});

	it("processes multiple file steps and returns created status for each", async () => {
		const steps: InitStep[] = ["a.md", "b.md", "c.md"].map((name) => ({
			name,
			status: "would-create" as const,
			category: "commands" as const,
			filePath: join(tempDir, name),
			content: `# ${name}\n`,
		}));

		const results = await applySteps(steps);

		for (const result of results) {
			expect(result.status).toBe("created");
			expect(result).not.toHaveProperty("content");
		}

		for (const step of steps) {
			const written = await readFile(step.filePath, "utf-8");
			expect(written).toBe(`# ${step.name}\n`);
		}
	});

	it("Zed config step (IDE, not VS Code): is written to disk", async () => {
		const filePath = join(tempDir, ".zed", "settings.json");
		const content = JSON.stringify({ file_types: { Markdown: ["*.aide"] } }, null, 2) + "\n";
		const step: InitStep = {
			name: "Zed config",
			status: "would-create",
			category: "ide",
			filePath,
			content,
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("created");
		expect(result).not.toHaveProperty("content");
		const written = await readFile(filePath, "utf-8");
		expect(written).toBe(content);
	});
});
