import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import locateBoard, { BOARD_HINT } from "./index.js";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, readFile: vi.fn(actual.readFile) };
});

const TAG = "my-project";

let roots: string[] = [];

/** Creates a temp brain folder, optionally with `kanban/<tag>` inside. */
async function makeBrain({ tag }: { tag?: string } = {}): Promise<string> {
	const brain = await mkdtemp(join(tmpdir(), "locate-board-"));
	roots.push(brain);
	if (tag) await mkdir(join(brain, "kanban", tag), { recursive: true });
	return brain;
}

beforeEach(() => {
	roots = [];
});

afterEach(async () => {
	for (const root of roots) await rm(root, { recursive: true, force: true });
});

describe("locateBoard", () => {
	it("answers no-brain-path when nothing was reported and no override is given", async () => {
		const result = await locateBoard({ reported: null });
		expect(result).toMatchObject({ state: "unavailable", reason: "no-brain-path" });
	});

	it("answers no-kanban-tag when a brain path was reported without a tag", async () => {
		const brain = await makeBrain({ tag: TAG });
		const result = await locateBoard({ reported: { brainPath: brain } });
		expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-tag" });
	});

	it("answers no-kanban-tag when only an override is given and no tag was reported", async () => {
		const brain = await makeBrain({ tag: TAG });
		const result = await locateBoard({ reported: null, brainOverride: brain });
		expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-tag" });
	});

	it("prefers the override over the reported brain path", async () => {
		const reportedBrain = await makeBrain({ tag: TAG });
		const overrideBrain = await makeBrain({ tag: TAG });
		const result = await locateBoard({
			reported: { brainPath: reportedBrain, kanbanTag: TAG },
			brainOverride: overrideBrain,
		});
		expect(result).toEqual({
			state: "located",
			boardFolder: join(overrideBrain, "kanban", TAG),
			kanbanTag: TAG,
		});
	});

	it("answers brain-path-missing when the reported path does not exist", async () => {
		const brain = await makeBrain();
		const missing = join(brain, "nope");
		const result = await locateBoard({ reported: { brainPath: missing, kanbanTag: TAG } });
		expect(result).toMatchObject({ state: "unavailable", reason: "brain-path-missing" });
		expect((result as { detail: string }).detail).toContain(missing);
	});

	it("answers brain-path-missing for a relative path", async () => {
		const result = await locateBoard({ reported: { brainPath: "relative/brain", kanbanTag: TAG } });
		expect(result).toMatchObject({ state: "unavailable", reason: "brain-path-missing" });
		expect((result as { detail: string }).detail).toContain("relative/brain");
	});

	it("answers brain-path-missing when the path is a file", async () => {
		const brain = await makeBrain();
		const file = join(brain, "file.txt");
		await writeFile(file, "x");
		const result = await locateBoard({ reported: { brainPath: file, kanbanTag: TAG } });
		expect(result).toMatchObject({ state: "unavailable", reason: "brain-path-missing" });
	});

	it("answers board-folder-missing when kanban/<tag> does not exist", async () => {
		const brain = await makeBrain();
		const result = await locateBoard({ reported: { brainPath: brain, kanbanTag: TAG } });
		expect(result).toMatchObject({ state: "unavailable", reason: "board-folder-missing" });
		expect((result as { detail: string }).detail).toContain(join(brain, "kanban", TAG));
	});

	it.each(["../other", "a/b", "a\\b", "..", ".hidden", "a..b"])(
		"rejects the tag %j so it can never point outside kanban/",
		async (tag) => {
			const brain = await makeBrain({ tag: "other" });
			const result = await locateBoard({ reported: { brainPath: brain, kanbanTag: tag } });
			expect(result).toMatchObject({ state: "unavailable", reason: "board-folder-missing" });
		},
	);

	it("treats an empty tag as no tag", async () => {
		const brain = await makeBrain({ tag: TAG });
		const result = await locateBoard({ reported: { brainPath: brain, kanbanTag: "" } });
		expect(result).toMatchObject({ state: "unavailable", reason: "no-kanban-tag" });
	});

	it("locates a valid board with its exact folder", async () => {
		const brain = await makeBrain({ tag: TAG });
		const result = await locateBoard({ reported: { brainPath: brain, kanbanTag: TAG } });
		expect(result).toEqual({
			state: "located",
			boardFolder: join(brain, "kanban", TAG),
			kanbanTag: TAG,
		});
	});

	it("carries the hint on every unavailable result", async () => {
		const brain = await makeBrain();
		const results = await Promise.all([
			locateBoard({ reported: null }),
			locateBoard({ reported: { brainPath: brain } }),
			locateBoard({ reported: { brainPath: "relative", kanbanTag: TAG } }),
			locateBoard({ reported: { brainPath: brain, kanbanTag: "../x" } }),
			locateBoard({ reported: { brainPath: brain, kanbanTag: TAG } }),
		]);
		for (const result of results) {
			expect(result).toMatchObject({ state: "unavailable", hint: BOARD_HINT });
		}
	});

	it("reads no file contents, only folder metadata", async () => {
		const brain = await makeBrain({ tag: TAG });
		vi.mocked(readFile).mockClear();
		await locateBoard({ reported: { brainPath: brain, kanbanTag: TAG } });
		await locateBoard({ reported: null });
		expect(readFile).not.toHaveBeenCalled();
	});
});
