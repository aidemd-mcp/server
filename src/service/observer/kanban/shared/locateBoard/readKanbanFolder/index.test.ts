import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import boardUnavailable from "../../boardUnavailable/index.js";
import readKanbanFolder from "./index.js";

let roots: string[] = [];

afterEach(async () => {
	for (const root of roots) await rm(root, { recursive: true, force: true });
	roots = [];
});

/** Creates an empty temp project root. */
async function makeProject(): Promise<string> {
	const projectRoot = await mkdtemp(join(tmpdir(), "read-kanban-folder-"));
	roots.push(projectRoot);
	return projectRoot;
}

/** Creates a temp project root holding `.aide/config/brain.aide` with the given text. */
async function makeProjectWithConfig(text: string): Promise<string> {
	const projectRoot = await makeProject();
	await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
	await writeFile(join(projectRoot, ".aide", "config", "brain.aide"), text);
	return projectRoot;
}

/** A frontmatter-only config: the launcher fields plus the given extra frontmatter lines. */
function frontmatterOnly(extra: string): string {
	return `---\nname: test\nmcpServerConfig:\n  command: mcpvault\n  args:\n    - "x"\n${extra}---\n`;
}

const KANBAN_FOLDER = join(tmpdir(), "my-brain", "kanban");

describe("readKanbanFolder", () => {
	it("reports no-brain-config when the file is absent", async () => {
		const projectRoot = await makeProject();

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({
				reason: "no-brain-config",
				detail: `${join(projectRoot, ".aide", "config", "brain.aide")} does not exist`,
			}),
		);
	});

	it("reports brain-config-unreadable when the path is a directory", async () => {
		const projectRoot = await makeProject();
		await mkdir(join(projectRoot, ".aide", "config", "brain.aide"), { recursive: true });

		const result = await readKanbanFolder({ projectRoot });

		expect(result).toMatchObject({ state: "unavailable", reason: "brain-config-unreadable" });
		expect((result as { detail: string }).detail).toMatch(
			/^the brain config cannot be read: cannot read \.aide\/config\/brain\.aide: .+\(EISDIR\)$/,
		);
	});

	it("reports brain-config-unreadable for malformed frontmatter", async () => {
		const projectRoot = await makeProjectWithConfig("no frontmatter here\n");

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({
				reason: "brain-config-unreadable",
				detail: "the brain config cannot be read: frontmatter is required",
			}),
		);
	});

	it("accepts a frontmatter-only config with a declared absolute path", async () => {
		const projectRoot = await makeProjectWithConfig(
			frontmatterOnly(`kanban:\n  source: folder\n  path: ${JSON.stringify(KANBAN_FOLDER)}\n`),
		);

		expect(await readKanbanFolder({ projectRoot })).toEqual({ state: "configured", kanbanFolder: KANBAN_FOLDER });
	});

	it("accepts the full bundled template with its path filled in", async () => {
		const template = obsidianBrainAideTemplate().replace("  path:\n---", `  path: ${JSON.stringify(KANBAN_FOLDER)}\n---`);
		const projectRoot = await makeProjectWithConfig(template);

		expect(await readKanbanFolder({ projectRoot })).toEqual({ state: "configured", kanbanFolder: KANBAN_FOLDER });
	});

	it("reports no-kanban-field when the config has no kanban key", async () => {
		const projectRoot = await makeProjectWithConfig(frontmatterOnly(""));

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({ reason: "no-kanban-field", detail: "the brain config declares no kanban field" }),
		);
	});

	it("reports no-kanban-field when kanban.path is empty", async () => {
		const projectRoot = await makeProjectWithConfig(frontmatterOnly("kanban:\n  source: folder\n  path:\n"));

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({
				reason: "no-kanban-field",
				detail: "the brain config's kanban.path is not filled in yet",
			}),
		);
	});

	it("reports unsupported-source for a non-folder source", async () => {
		const projectRoot = await makeProjectWithConfig(
			frontmatterOnly(`kanban:\n  source: command\n  path: ${JSON.stringify(KANBAN_FOLDER)}\n`),
		);

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({
				reason: "unsupported-source",
				detail:
					"the brain config's kanban.source `command` is not a supported source; the only supported source is `folder`",
			}),
		);
	});

	it("reports kanban-field-malformed for a relative path", async () => {
		const projectRoot = await makeProjectWithConfig(
			frontmatterOnly(`kanban:\n  source: folder\n  path: "my-brain/kanban"\n`),
		);

		expect(await readKanbanFolder({ projectRoot })).toEqual(
			boardUnavailable({
				reason: "kanban-field-malformed",
				detail: `the brain config's kanban.path must be an absolute path, got "my-brain/kanban"`,
			}),
		);
	});
});
