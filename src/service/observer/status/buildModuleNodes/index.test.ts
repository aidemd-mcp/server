import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import scan from "@/util/scan/index.js";
import buildModuleNodes from "./index.js";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "build-module-nodes-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function writeAide(relPath: string, text: string): Promise<void> {
	const full = join(root, relPath);
	await mkdir(dirname(full), { recursive: true });
	await writeFile(full, text);
}

const SPEC = "---\nalignment: aligned\nintent: x\n---\n";
const PLAN = (status: string) => `---\nstatus: ${status}\nintent: x\n---\n## Plan\n### 1. A\n- [x] a\n### 2. B\n- [ ] b\n`;

/** Every file's path, size and mtime under the root, for before/after comparison. */
async function snapshot(dir: string, base = ""): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) out.push(...(await snapshot(join(dir, entry.name), rel)));
		else {
			const info = await stat(join(dir, entry.name));
			out.push(`${rel}|${info.size}|${info.mtimeMs}`);
		}
	}
	return out.sort();
}

async function writeFullProject(): Promise<void> {
	await writeAide(".aide/intent.aide", SPEC);
	await writeAide(".aide/session.aide", "## Notes\n");
	await writeAide(".aide/config/brain.aide", "launcher: x\n");
	await writeAide("src/a/.aide", SPEC);
	await writeAide("src/a/brief.aide", "---\nstatus: approved\n---\nbody\n");
	await writeAide("src/a/plan.aide", PLAN("approved"));
	await writeAide("src/a/todo.aide", "---\nstatus: proposed\n---\n- [ ] fix\n");
	await writeAide("src/a/research.aide", "---\nintent: r\n---\n");
}

describe("buildModuleNodes", () => {
	it("shows every AIDE file exactly once, grouped by node folder", async () => {
		await writeFullProject();
		const nodes = await buildModuleNodes({ projectRoot: root });
		const scanned = (await scan(root)).files.length;

		expect(scanned).toBe(8);
		expect(nodes.flatMap((node) => node.files)).toHaveLength(scanned);
		expect(nodes.map((node) => node.folder)).toEqual([".", ".aide/config", "src/a"]);

		const rootNode = nodes[0];
		expect(rootNode.parent).toBeNull();
		expect(rootNode.files.map((f) => f.kind)).toEqual(["intent", "session"]);
		expect(nodes[1].parent).toBe(".");
		expect(nodes[2].parent).toBe(".");
		expect(nodes[2].files.map((f) => f.kind)).toEqual(["intent", "brief", "research", "plan", "todo"]);
	});

	it("lists a folder holding only a plan as a node with just that plan", async () => {
		await writeAide("src/solo/plan.aide", PLAN("proposed"));
		const nodes = await buildModuleNodes({ projectRoot: root });
		expect(nodes).toHaveLength(1);
		expect(nodes[0]).toMatchObject({ folder: "src/solo", parent: null });
		expect(nodes[0].files.map((f) => f.kind)).toEqual(["plan"]);
	});

	it("isolates broken YAML to its own entry", async () => {
		await writeFullProject();
		await writeAide("src/b/.aide", SPEC);
		await writeAide("src/a/plan.aide", "---\nstatus: [unclosed\n---\n- [ ] a\n");
		const nodes = await buildModuleNodes({ projectRoot: root });
		const entries = nodes.flatMap((node) => node.files);

		expect(entries.find((f) => f.file === "src/a/plan.aide")?.read.state).toBe("malformed");
		expect(entries.filter((f) => f.read.state === "malformed")).toHaveLength(1);
		expect(entries.find((f) => f.file === "src/a/todo.aide")?.read).toMatchObject({ state: "present", status: "proposed" });
		expect(entries.find((f) => f.file === "src/b/.aide")?.read).toMatchObject({ state: "present", alignment: "aligned" });
	});

	it("reads the older status key on an intent spec as alignment", async () => {
		await writeAide("src/old/.aide", "---\nstatus: misaligned\nintent: x\n---\n");
		const nodes = await buildModuleNodes({ projectRoot: root });
		expect(nodes[0].files[0].read).toMatchObject({ state: "present", alignment: "misaligned" });
	});

	it("leaves the project folder untouched", async () => {
		await writeFullProject();
		const before = await snapshot(root);
		await buildModuleNodes({ projectRoot: root });
		expect(await snapshot(root)).toEqual(before);
	});
});
