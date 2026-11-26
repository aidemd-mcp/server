import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import writeBrainConfig from "./index.js";

let projectRoot: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-write-brain-config-"));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

describe("writeBrainConfig", () => {
	it("writes a frontmatter-only config that parses as missing-sections with the kanban field declared", async () => {
		const brainPath = join(projectRoot, "brain");
		const kanbanFolder = join(brainPath, "kanban");

		await writeBrainConfig({ projectRoot, brainPath, kanbanFolder });

		const parsed = await parseBrainAide(projectRoot);
		expect(parsed.kind).toBe("missing-sections");
		expect(parsed).toMatchObject({ name: "fixture", kanban: { state: "declared", source: "folder", path: kanbanFolder } });
	});

	it("writes exactly the frontmatter with LF line endings and no body", async () => {
		await writeBrainConfig({ projectRoot, brainPath: "/b", kanbanFolder: "/b/kanban" });

		const text = await readFile(join(projectRoot, ".aide", "config", "brain.aide"), "utf-8");
		expect(text).toBe(
			['---', 'name: fixture', 'mcpServerConfig:', '  command: mcpvault', '  args:', '    - "/b"', 'kanban:', '  source: folder', '  path: "/b/kanban"', '---', ''].join("\n"),
		);
	});
});
