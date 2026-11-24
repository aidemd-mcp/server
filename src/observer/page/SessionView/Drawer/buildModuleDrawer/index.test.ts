import { describe, expect, it } from "vitest";
import type { ModuleFiles } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import buildModuleDrawer from "./index.js";

const FILES: ModuleFiles = {
	spec: "---\nscope: src/tools/score\nintent: Rank modules.\n---\n\n## Context\n\nWhy.\n",
	plan: "### 1. First\n\n- [x] First\n\n### 2. Second\n\n- [ ] Second\n",
	todo: "- [ ] **a.ts:1** — broken\n\n## Retro\n\n- lesson\n",
	brief: null,
};
const CONTEXT = makeContext({ status: makeStatus({ tree: [SCORE_NODE], running: [makeWork()] }) });

const headings = (blocks: { heading: string }[]) => blocks.map((block) => block.heading);

describe("buildModuleDrawer", () => {
	it("is a Module titled by its folder, with the observer's facts as meta, and blocks in spec, plan, todo order", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: FILES, context: CONTEXT });
		expect(drawer).toMatchObject({ kind: "Module", title: "src/tools/score", titleMono: true, meta: "aligned · plan approved 3/9 · working now" });
		expect(headings(drawer.blocks)).toEqual(["Spec frontmatter", "Body", "Plan", "Todo", "Retro"]);
	});

	it("puts an opened todo's blocks first and says so in the kind", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: "todo", files: FILES, context: CONTEXT });
		expect(drawer.kind).toBe("Module · todo");
		expect(headings(drawer.blocks)).toEqual(["Todo", "Retro", "Spec frontmatter", "Body", "Plan"]);
	});

	it("puts an opened plan first and keeps the kind Module", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: "plan", files: FILES, context: CONTEXT });
		expect(drawer.kind).toBe("Module");
		expect(headings(drawer.blocks)).toEqual(["Plan", "Spec frontmatter", "Body", "Todo", "Retro"]);
	});

	it("shows an opened brief first", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: "brief", files: { ...FILES, brief: "1. Commitment" }, context: CONTEXT });
		expect(headings(drawer.blocks)[0]).toBe("Brief");
	});

	it("adds no block for a file the module lists none of", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: { spec: null, plan: FILES.plan, todo: null, brief: null }, context: CONTEXT });
		expect(headings(drawer.blocks)).toEqual(["Plan"]);
	});

	it("draws the root as the tree does", () => {
		const root = { folder: ".", parent: null, files: [SCORE_NODE.files[0]!] };
		const context = makeContext({ status: makeStatus({ tree: [{ ...root, files: [{ ...root.files[0]!, folder: ".", file: ".aide/intent.aide" }] }] }) });
		expect(buildModuleDrawer({ folder: ".", firstKind: null, files: { spec: null, plan: null, todo: null, brief: null }, context }).title).toBe(".aide/intent.aide");
	});

	it("keeps the title and an empty body for a module the tree does not list", () => {
		const drawer = buildModuleDrawer({ folder: "src/none", firstKind: null, files: { spec: null, plan: null, todo: null, brief: null }, context: makeContext({ status: null }) });
		expect(drawer).toEqual({ kind: "Module", title: "src/none", titleMono: true, meta: null, blocks: [] });
	});
});
