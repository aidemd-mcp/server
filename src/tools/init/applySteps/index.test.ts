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

	it("brain file step: content is written to the file at filePath", async () => {
		const filePath = join(tempDir, "vault", "coding-playbook", "coding-playbook.md");
		const content = "# Coding Playbook\n\n## Task Routing\n";
		const step: InitStep = {
			name: "Playbook hub",
			status: "would-create",
			category: "brain",
			filePath,
			content,
		};

		await applySteps([step]);

		const written = await readFile(filePath, "utf-8");
		expect(written).toBe(content);
	});

	it("brain file step: returned step has status created and no content field", async () => {
		const filePath = join(tempDir, "vault", "coding-playbook", "coding-playbook.md");
		const step: InitStep = {
			name: "Playbook hub",
			status: "would-create",
			category: "brain",
			filePath,
			content: "# Coding Playbook\n",
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("created");
		expect(result).not.toHaveProperty("content");
	});

	it("brain directory step with extension-free filePath: creates directories from JSON content", async () => {
		const brainPath = join(tempDir, "vault");
		const dirs = ["research", "coding-playbook"];
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

	it("brain step with exists status: passes through unchanged, nothing written", async () => {
		const filePath = join(tempDir, "vault", "coding-playbook", "coding-playbook.md");
		const step: InitStep = {
			name: "Playbook hub",
			status: "exists",
			category: "brain",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(await pathExists(filePath)).toBe(false);
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

	it("would-overwrite file step: file is written to disk", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "would-overwrite",
			category: "methodology",
			filePath,
			content: "# AIDE\n\nupdated content\n",
		};

		await applySteps([step]);

		const written = await readFile(filePath, "utf-8");
		expect(written).toBe("# AIDE\n\nupdated content\n");
	});

	it("would-overwrite file step: returned step has status overwritten and no content field", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "would-overwrite",
			category: "methodology",
			filePath,
			content: "# AIDE\n\nupdated content\n",
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("overwritten");
		expect(result).not.toHaveProperty("content");
	});

	it("would-overwrite brain file step: content is written to the file at filePath", async () => {
		const filePath = join(tempDir, "vault", "coding-playbook", "coding-playbook.md");
		const content = "# Coding Playbook\n\n## Updated Section\n";
		const step: InitStep = {
			name: "Playbook hub",
			status: "would-overwrite",
			category: "brain",
			filePath,
			content,
		};

		await applySteps([step]);

		const written = await readFile(filePath, "utf-8");
		expect(written).toBe(content);
	});

	it("would-overwrite brain file step: returned step has status overwritten and no content field", async () => {
		const filePath = join(tempDir, "vault", "coding-playbook", "coding-playbook.md");
		const step: InitStep = {
			name: "Playbook hub",
			status: "would-overwrite",
			category: "brain",
			filePath,
			content: "# Coding Playbook\n\nupdated\n",
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("overwritten");
		expect(result).not.toHaveProperty("content");
	});

	it("would-overwrite MCP prescription step: passes through unchanged, nothing written", async () => {
		const filePath = join(tempDir, ".mcp.json");
		const prescription = {
			key: "aide",
			entry: { command: "npx", args: ["@aidemd-mcp/server"] },
		};
		const step: InitStep = {
			name: "MCP config (aide)",
			status: "would-overwrite",
			category: "mcp",
			filePath,
			prescription,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(result.prescription).toEqual(prescription);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("would-overwrite VS Code IDE step: passes through without writing to disk", async () => {
		const filePath = join(tempDir, "aide-markdown.vsix");
		const step: InitStep = {
			name: "VS Code extension",
			status: "would-overwrite",
			category: "ide",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result.status).toBe("would-overwrite");
		expect(result.category).toBe("ide");
		expect(result.filePath).toBe(filePath);
		expect(await pathExists(filePath)).toBe(false);
	});

	it("would-overwrite VS Code IDE step: instructions field is set to the code --install-extension command", async () => {
		const filePath = join(tempDir, "aide-markdown.vsix");
		const step: InitStep = {
			name: "VS Code extension",
			status: "would-overwrite",
			category: "ide",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result.instructions).toBe(`code --install-extension ${filePath}`);
	});

	it("mixed would-create and would-overwrite batch: returns matching created and overwritten statuses", async () => {
		const createFile = join(tempDir, "new-file.md");
		const overwriteFile = join(tempDir, "existing-file.md");

		const steps: InitStep[] = [
			{
				name: "New file",
				status: "would-create",
				category: "commands",
				filePath: createFile,
				content: "# new\n",
			},
			{
				name: "Existing file",
				status: "would-overwrite",
				category: "commands",
				filePath: overwriteFile,
				content: "# updated\n",
			},
		];

		const results = await applySteps(steps);

		expect(results[0].status).toBe("created");
		expect(results[0]).not.toHaveProperty("content");
		expect(await pathExists(createFile)).toBe(true);

		expect(results[1].status).toBe("overwritten");
		expect(results[1]).not.toHaveProperty("content");
		expect(await pathExists(overwriteFile)).toBe(true);
	});

	it("idempotency: overwritten step passes through unchanged when replayed", async () => {
		const filePath = join(tempDir, "CLAUDE.md");
		const step: InitStep = {
			name: "Methodology pointer",
			status: "overwritten",
			category: "methodology",
			filePath,
		};

		const [result] = await applySteps([step]);

		expect(result).toEqual(step);
		expect(await pathExists(filePath)).toBe(false);
	});
});
