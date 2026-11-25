import { describe, expect, it } from "vitest";
import type { ModuleFiles } from "@/observer/page/types/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import makeWork from "@/observer/page/__fixtures__/makeWork/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import buildModuleDrawer from "./index.js";

const NONE: ModuleFiles = { spec: null, plan: null, todo: null, brief: null, research: null, session: null };
const FILES: ModuleFiles = {
	...NONE,
	spec: "---\nscope: src/tools/score\nintent: Rank modules.\n---\n\n## Context\n\nWhy.\n",
	plan: "### 1. First\n\n- [x] First\n\n### 2. Second\n\n- [ ] Second\n",
	todo: "- [ ] **a.ts:1** — broken\n\n## Retro\n\n- lesson\n",
};
const CONTEXT = makeContext({ status: makeStatus({ tree: [SCORE_NODE], running: [makeWork()] }) });

const kindsOf = (drawer: ReturnType<typeof buildModuleDrawer>) => drawer.sections?.list.map((section) => section.kind);

describe("buildModuleDrawer", () => {
	it("is a Module titled by its folder, with the observer's facts as meta", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: FILES, context: CONTEXT });
		expect(drawer).toMatchObject({ kind: "Module", title: "src/tools/score", titleMono: true, meta: "aligned · plan approved 3/9 · working now", alignment: "aligned" });
	});

	it("holds one section per file the module has, in spec, session, brief, plan, todo, research order, each labelled by its file name", () => {
		const files: ModuleFiles = { ...FILES, brief: "1. Commitment", research: "# Findings" };
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files, context: CONTEXT });
		expect(kindsOf(drawer)).toEqual(["spec", "brief", "plan", "todo", "research"]);
		expect(drawer.sections?.list.find((section) => section.kind === "spec")).toMatchObject({ path: "src/tools/score/.aide", label: ".aide", status: "aligned" });
		expect(drawer.sections?.list.find((section) => section.kind === "plan")).toMatchObject({ path: "src/tools/score/plan.aide", label: "plan.aide", status: "approved · 3/9" });
		expect(drawer.sections?.list.find((section) => section.kind === "todo")).toMatchObject({ path: "src/tools/score/todo.aide", label: "todo.aide", status: "2 open of 5" });
	});

	it("builds each section from every part of its file (frontmatter fields and `##` sections)", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: FILES, context: CONTEXT });
		const spec = drawer.sections?.list.find((section) => section.kind === "spec");
		expect(spec?.blocks.map((block) => block.heading)).toEqual(["Frontmatter", "## Context"]);
		const todo = drawer.sections?.list.find((section) => section.kind === "todo");
		expect(todo?.blocks.map((block) => block.heading)).toEqual(["Body", "## Retro"]);
	});

	it("flattens every section's blocks into the drawer's blocks", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: FILES, context: CONTEXT });
		expect(drawer.blocks).toEqual(drawer.sections!.list.flatMap((section) => section.blocks));
	});

	it("opens the spec first when no file was opened, and the opened file's section otherwise", () => {
		expect(buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: FILES, context: CONTEXT }).sections?.open).toBe("spec");
		expect(buildModuleDrawer({ folder: "src/tools/score", firstKind: "todo", files: FILES, context: CONTEXT }).sections?.open).toBe("todo");
		expect(buildModuleDrawer({ folder: "src/tools/score", firstKind: "plan", files: FILES, context: CONTEXT }).sections?.open).toBe("plan");
	});

	it("keeps the kind Module whichever file was opened", () => {
		expect(buildModuleDrawer({ folder: "src/tools/score", firstKind: "todo", files: FILES, context: CONTEXT }).kind).toBe("Module");
	});

	it("opens an opened brief, which the tree lists no path for, under its kind as the label", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: "brief", files: { ...FILES, brief: "1. Commitment" }, context: CONTEXT });
		expect(drawer.sections?.open).toBe("brief");
		expect(drawer.sections?.list.find((section) => section.kind === "brief")).toMatchObject({ path: "", label: "brief", status: null });
	});

	it("opens the first section when the opened file has none", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: "research", files: { ...FILES, research: null }, context: CONTEXT });
		expect(drawer.sections?.open).toBe("spec");
	});

	it("adds no section for a file the module lists none of", () => {
		const drawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: { ...NONE, plan: FILES.plan }, context: CONTEXT });
		expect(kindsOf(drawer)).toEqual(["plan"]);
		expect(drawer.sections?.open).toBe("plan");
	});

	it("gives the root a session section on .aide/session.aide, and no other module one", () => {
		const root = { folder: ".", parent: null, files: [{ ...SCORE_NODE.files[0]!, folder: ".", file: ".aide/intent.aide" }] };
		const context = makeContext({ status: makeStatus({ tree: [root] }) });
		const session = "---\nstatus: active\n---\n\n## Intent\n\nShip it.\n";
		const rootDrawer = buildModuleDrawer({ folder: ".", firstKind: null, files: { ...NONE, session }, context });
		expect(rootDrawer.sections?.list).toEqual([
			{ kind: "session", path: ".aide/session.aide", label: "session.aide", status: null, blocks: expect.any(Array) },
		]);
		const moduleDrawer = buildModuleDrawer({ folder: "src/tools/score", firstKind: null, files: { ...NONE, session }, context: CONTEXT });
		expect(moduleDrawer.sections?.list[0]).toMatchObject({ kind: "session", path: "", label: "session" });
	});

	it("titles the root as the tree labels it, and points its spec at .aide/intent.aide", () => {
		const root = { folder: ".", parent: null, files: [SCORE_NODE.files[0]!] };
		const context = makeContext({ status: makeStatus({ tree: [{ ...root, files: [{ ...root.files[0]!, folder: ".", file: ".aide/intent.aide" }] }] }) });
		const drawer = buildModuleDrawer({ folder: ".", firstKind: null, files: { ...NONE, spec: FILES.spec }, context });
		expect(drawer.title).toBe("root");
		expect(drawer.sections?.list[0]?.path).toBe(".aide/intent.aide");
	});

	it("keeps the title and an empty body for a module the tree does not list", () => {
		const drawer = buildModuleDrawer({ folder: "src/none", firstKind: null, files: NONE, context: makeContext({ status: null }) });
		expect(drawer).toEqual({ kind: "Module", title: "src/none", titleMono: true, meta: null, blocks: [], alignment: null, sections: { open: "spec", list: [] } });
	});
});
