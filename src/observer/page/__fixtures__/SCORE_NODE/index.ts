import type { ModuleNode } from "@/types/index.js";
import makeFile from "@/observer/page/__fixtures__/makeFile/index.js";
import makeSpec from "@/observer/page/__fixtures__/makeSpec/index.js";

/** The tree node `src/tools/score` holding a spec, a plan (3 of 9, approved) and a todo (2 of 5 open). */
const SCORE_NODE: ModuleNode = {
	folder: "src/tools/score",
	parent: null,
	files: [
		makeSpec({ folder: "src/tools/score", file: "src/tools/score/.aide" }),
		makeFile({ kind: "plan", folder: "src/tools/score", file: "src/tools/score/plan.aide", status: "approved", done: 3, total: 9 }),
		makeFile({ kind: "todo", folder: "src/tools/score", file: "src/tools/score/todo.aide", status: "approved", done: 3, total: 5 }),
	],
};

export default SCORE_NODE;
