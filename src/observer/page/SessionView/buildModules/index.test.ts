import { describe, expect, it } from "vitest";
import type { ModuleNode, TreeFileEntry } from "@/types/index.js";
import buildModules from "./index.js";

const progress = { done: 0, total: 0, open: 0 };

function intent({ folder, file, alignment }: { folder: string; file: string; alignment: "aligned" | "unset" }): TreeFileEntry {
	return { kind: "intent", file, folder, read: { state: "present", alignment, description: `about ${folder}`, progress } };
}

function work({
	kind,
	folder,
	file,
	status,
	steps,
	counts,
}: {
	kind: "brief" | "plan" | "todo";
	folder: string;
	file: string;
	status: "proposed" | "approved" | "completed" | "abandoned" | "unset";
	steps: { done: number; total: number };
	counts: { done: number; total: number; open: number };
}): TreeFileEntry {
	return {
		kind,
		file,
		folder,
		read: { state: "present", status, awaitingApproval: status === "proposed", progress: counts, steps },
	};
}

function node({ folder, files }: { folder: string; files: TreeFileEntry[] }): ModuleNode {
	return { folder, parent: folder === "." ? null : ".", files };
}

describe("buildModules", () => {
	it("lists the root first, labelled `root`, with the intent spec's own values", () => {
		const rows = buildModules({
			tree: [
				node({ folder: "src/a", files: [intent({ folder: "src/a", file: "src/a/.aide", alignment: "aligned" })] }),
				node({ folder: ".", files: [intent({ folder: ".", file: ".aide/intent.aide", alignment: "aligned" })] }),
			],
		});
		expect(rows.map((row) => row.folder)).toEqual([".", "src/a"]);
		expect(rows[0]).toMatchObject({
			label: "root",
			intentFile: ".aide/intent.aide",
			alignment: "aligned",
			description: "about .",
		});
	});

	it("builds the chips of a folder with intent, brief, plan, todo and research", () => {
		const [row] = buildModules({
			tree: [
				node({
					folder: "src/x",
					files: [
						intent({ folder: "src/x", file: "src/x/.aide", alignment: "aligned" }),
						work({ kind: "brief", folder: "src/x", file: "src/x/brief.aide", status: "approved", steps: { done: 0, total: 0 }, counts: progress }),
						work({ kind: "plan", folder: "src/x", file: "src/x/plan.aide", status: "approved", steps: { done: 3, total: 9 }, counts: { done: 3, total: 12, open: 9 } }),
						work({ kind: "todo", folder: "src/x", file: "src/x/todo.aide", status: "approved", steps: { done: 3, total: 5 }, counts: { done: 3, total: 5, open: 2 } }),
						{ kind: "research", file: "src/x/research.aide", folder: "src/x", read: { state: "present", progress } },
					],
				}),
			],
		});
		expect(row).toEqual({
			folder: "src/x",
			label: "src/x",
			description: "about src/x",
			alignment: "aligned",
			intentFile: "src/x/.aide",
			brief: "src/x/brief.aide",
			plan: { file: "src/x/plan.aide", status: "approved", done: 3, total: 9 },
			todo: { file: "src/x/todo.aide", open: 2, total: 5 },
			research: "src/x/research.aide",
			malformed: [],
		});
	});

	it("maps an unset alignment to null", () => {
		const [row] = buildModules({
			tree: [node({ folder: "src/a", files: [intent({ folder: "src/a", file: "src/a/.aide", alignment: "unset" })] })],
		});
		expect(row?.alignment).toBeNull();
	});

	it("lists a malformed plan and gives plan null", () => {
		const [row] = buildModules({
			tree: [
				node({
					folder: "src/b",
					files: [{ kind: "plan", file: "src/b/plan.aide", folder: "src/b", read: { state: "malformed", error: "bad yaml" } }],
				}),
			],
		});
		expect(row?.plan).toBeNull();
		expect(row?.malformed).toEqual(["src/b/plan.aide"]);
	});

	it("skips nodes that hold only session or other files", () => {
		const rows = buildModules({
			tree: [
				node({
					folder: "src/c",
					files: [{ kind: "other", file: "src/c/notes.aide", folder: "src/c", read: { state: "present", progress } }],
				}),
			],
		});
		expect(rows).toEqual([]);
	});
});
