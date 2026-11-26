import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import locateBoard from "./index.js";
import boardHints from "../boardHints/index.js";
import type { BoardUnavailable } from "@/service/observer/kanban/types/index.js";

const TAG = "my-project";

let roots: string[] = [];

/** Creates a temp folder and tracks it for removal. */
async function makeFolder(prefix: string): Promise<string> {
	const folder = await mkdtemp(join(tmpdir(), prefix));
	roots.push(folder);
	return folder;
}

/** Writes a frontmatter-only brain config with the given extra frontmatter lines into a project root. */
async function writeConfig({ projectRoot, extra }: { projectRoot: string; extra: string }): Promise<void> {
	await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
	await writeFile(
		join(projectRoot, ".aide", "config", "brain.aide"),
		`---\nname: test\nmcpServerConfig:\n  command: mcpvault\n  args:\n    - "x"\n${extra}---\n`,
	);
}

/** The kanban field extra lines for a folder-sourced board at the given path. */
function kanbanField(path: string): string {
	return `kanban:\n  source: folder\n  path: ${JSON.stringify(path)}\n`;
}

/** Creates a temp project root whose brain config points at a temp kanban folder, optionally holding `<tag>`. */
async function makeProject({ tag }: { tag?: string } = {}): Promise<{ projectRoot: string; kanbanFolder: string }> {
	const projectRoot = await makeFolder("locate-board-project-");
	const kanbanFolder = await makeFolder("locate-board-kanban-");
	if (tag) await mkdir(join(kanbanFolder, tag), { recursive: true });
	await writeConfig({ projectRoot, extra: kanbanField(kanbanFolder) });
	return { projectRoot, kanbanFolder };
}

beforeEach(() => {
	roots = [];
});

afterEach(async () => {
	for (const root of roots) await rm(root, { recursive: true, force: true });
});

describe("locateBoard", () => {
	describe("the kanban folder from the brain config", () => {
		it("locates the board at <configured kanban folder>/<tag>", async () => {
			const { projectRoot, kanbanFolder } = await makeProject({ tag: TAG });

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toEqual({ state: "located", boardFolder: join(kanbanFolder, TAG), kanbanTag: TAG });
		});

		it.each<{ name: string; extra: string | null; reason: BoardUnavailable["reason"] }>([
			{ name: "no config file", extra: null, reason: "no-brain-config" },
			{ name: "no kanban field", extra: "", reason: "no-kanban-field" },
			{ name: "an unfilled kanban.path", extra: "kanban:\n  source: folder\n  path:\n", reason: "no-kanban-field" },
			{ name: "a malformed kanban field", extra: "kanban:\n  source: folder\n  path: relative/kanban\n", reason: "kanban-field-malformed" },
			{ name: "another source", extra: "kanban:\n  source: command\n", reason: "unsupported-source" },
		])("answers $reason for $name, with that reason's hint", async ({ extra, reason }) => {
			const projectRoot = await makeFolder("locate-board-project-");
			if (extra !== null) await writeConfig({ projectRoot, extra });

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toMatchObject({ state: "unavailable", reason, hint: boardHints[reason] });
		});

		it("answers brain-config-unreadable when the config cannot be read", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
			await writeFile(join(projectRoot, ".aide", "config", "brain.aide"), "no frontmatter here\n");

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toMatchObject({
				state: "unavailable",
				reason: "brain-config-unreadable",
				hint: boardHints["brain-config-unreadable"],
			});
		});

		it("answers kanban-folder-missing when the configured folder does not exist", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			const missing = join(tmpdir(), "locate-board-never-created", "kanban");
			await writeConfig({ projectRoot, extra: kanbanField(missing) });

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toEqual({
				state: "unavailable",
				reason: "kanban-folder-missing",
				detail: `${missing} is not a folder that exists`,
				hint: boardHints["kanban-folder-missing"],
			});
		});

		it("answers kanban-folder-missing when the configured path is a file", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			const file = join(await makeFolder("locate-board-file-"), "kanban.txt");
			await writeFile(file, "x");
			await writeConfig({ projectRoot, extra: kanbanField(file) });

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toMatchObject({ state: "unavailable", reason: "kanban-folder-missing" });
			expect((result as BoardUnavailable).detail).toBe(`${file} is not a folder that exists`);
		});
	});

	describe("the order of the checks", () => {
		it("answers the config reason, not no-kanban-tag, when there is no config and no tag", async () => {
			const projectRoot = await makeFolder("locate-board-project-");

			const result = await locateBoard({ projectRoot, reported: null });

			expect(result).toMatchObject({ state: "unavailable", reason: "no-brain-config" });
		});

		it("answers no-kanban-tag once the config gives a kanban folder", async () => {
			const { projectRoot } = await makeProject({ tag: TAG });

			const result = await locateBoard({ projectRoot, reported: null });

			expect(result).toEqual({
				state: "unavailable",
				reason: "no-kanban-tag",
				detail: "no session has reported a kanban tag",
				hint: boardHints["no-kanban-tag"],
			});
		});

		it("treats an empty tag as no tag", async () => {
			const { projectRoot } = await makeProject({ tag: TAG });

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: "" } });

			expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-tag" });
		});
	});

	describe("the kanban folder override", () => {
		it("works with no brain config at all and still takes the tag from the report", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			const kanbanFolder = await makeFolder("locate-board-kanban-");
			await mkdir(join(kanbanFolder, TAG));

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG }, kanbanOverride: kanbanFolder });

			expect(result).toEqual({ state: "located", boardFolder: join(kanbanFolder, TAG), kanbanTag: TAG });
		});

		it("wins over the configured kanban folder", async () => {
			const { projectRoot } = await makeProject({ tag: TAG });
			const overrideFolder = await makeFolder("locate-board-override-");
			await mkdir(join(overrideFolder, TAG));

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG }, kanbanOverride: overrideFolder });

			expect(result).toMatchObject({ state: "located", boardFolder: join(overrideFolder, TAG) });
		});

		it("answers no-kanban-tag when only an override is given and no tag was reported", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			const kanbanFolder = await makeFolder("locate-board-kanban-");

			const result = await locateBoard({ projectRoot, reported: null, kanbanOverride: kanbanFolder });

			expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-tag" });
		});

		it("names the view command on the missing-folder detail", async () => {
			const projectRoot = await makeFolder("locate-board-project-");
			const missing = join(tmpdir(), "locate-board-never-created", "override");

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG }, kanbanOverride: missing });

			expect(result).toMatchObject({ state: "unavailable", reason: "kanban-folder-missing" });
			expect((result as BoardUnavailable).detail).toBe(
				`${missing} is not a folder that exists (the kanban folder the view command was given)`,
			);
		});

		it("names the view command on the not-absolute detail", async () => {
			const projectRoot = await makeFolder("locate-board-project-");

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG }, kanbanOverride: "relative/kanban" });

			expect(result).toMatchObject({ state: "unavailable", reason: "kanban-folder-missing" });
			expect((result as BoardUnavailable).detail).toBe(
				"relative/kanban is not an absolute path (the kanban folder the view command was given)",
			);
		});
	});

	describe("the tag and the board folder", () => {
		it.each(["../other", "a/b", "a\\b", "..", ".hidden", "a..b"])(
			"rejects the tag %j so it can never point outside the kanban folder",
			async (tag) => {
				const { projectRoot } = await makeProject({ tag: "other" });

				const result = await locateBoard({ projectRoot, reported: { kanbanTag: tag } });

				expect(result).toEqual({
					state: "unavailable",
					reason: "board-folder-missing",
					detail: `${tag} is not a single folder name`,
					hint: boardHints["board-folder-missing"],
				});
			},
		);

		it("answers board-folder-missing when <kanban folder>/<tag> does not exist", async () => {
			const { projectRoot, kanbanFolder } = await makeProject();

			const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

			expect(result).toMatchObject({ state: "unavailable", reason: "board-folder-missing" });
			expect((result as BoardUnavailable).detail).toBe(`${join(kanbanFolder, TAG)} is not a folder that exists`);
		});
	});

	it("never reads the launcher: a config whose launcher names a brain folder still locates only from the kanban field", async () => {
		const projectRoot = await makeFolder("locate-board-project-");
		const brain = await makeFolder("locate-board-brain-");
		await mkdir(join(brain, "kanban", TAG), { recursive: true });
		await mkdir(join(projectRoot, ".aide", "config"), { recursive: true });
		await writeFile(
			join(projectRoot, ".aide", "config", "brain.aide"),
			`---\nname: test\nmcpServerConfig:\n  command: mcpvault\n  args:\n    - ${JSON.stringify(brain)}\n---\n`,
		);

		const result = await locateBoard({ projectRoot, reported: { kanbanTag: TAG } });

		expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-field" });
	});
});
