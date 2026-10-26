import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import validate from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-validate-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("validate", () => {
	it("returns no warnings for a healthy project", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(
			join(tempDir, ".aide"),
			"---\ndescription: A healthy spec with all required fields\nalignment: unreviewed\n---\nClean spec with no links",
		);

		const result = await validate(tempDir);

		expect(result.warnings).toHaveLength(0);
	});

	it("detects naming conflicts", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(join(tempDir, ".aide"), "Intent");
		await writeFile(join(tempDir, "intent.aide"), "Also intent");

		const result = await validate(tempDir);
		const conflict = result.warnings.find((w) => w.kind === "naming-conflict");

		expect(conflict).toBeDefined();
	});

	it("detects broken relative links", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(join(tempDir, ".aide"), "See ./nonexistent/helper.ts for details");

		const result = await validate(tempDir);
		const broken = result.warnings.find((w) => w.kind === "broken-link");

		expect(broken).toBeDefined();
		expect(broken!.message).toContain("./nonexistent/helper.ts");
	});

	it("does not flag valid relative links as broken", async () => {
		await mkdir(join(tempDir, "sub"), { recursive: true });
		await writeFile(join(tempDir, "sub", "helper.ts"), "export default 1;");
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(join(tempDir, ".aide"), "See ./sub/helper.ts");

		const result = await validate(tempDir);
		const broken = result.warnings.find((w) => w.kind === "broken-link");

		expect(broken).toBeUndefined();
	});

	it("detects orphaned research", async () => {
		await writeFile(join(tempDir, "index.ts"), "export default function() {}");
		await writeFile(join(tempDir, "research.aide"), "Research without intent");

		const result = await validate(tempDir);
		const orphaned = result.warnings.find((w) => w.kind === "orphaned-research");

		expect(orphaned).toBeDefined();
	});

	it("detects missing description field and returns missing-description warning", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"---\nscope: some-scope\nintent: Some intent\n---\n",
		);

		const result = await validate(tempDir);
		const missing = result.warnings.find((w) => w.kind === "missing-description");

		expect(missing).toBeDefined();
		expect(missing!.message).toContain("description");
	});

	it("does not warn about missing description when description is present", async () => {
		await writeFile(
			join(tempDir, ".aide"),
			"---\ndescription: A complete spec\nscope: some-scope\nintent: Some intent\n---\n",
		);

		const result = await validate(tempDir);
		const missing = result.warnings.find((w) => w.kind === "missing-description");

		expect(missing).toBeUndefined();
	});

	describe("alignment", () => {
		const isAlignment = (w: { kind: string }) =>
			w.kind === "missing-alignment" || w.kind === "invalid-alignment";

		it("warns once, for the one intent spec that records no alignment", async () => {
			const spec = (extra: string) => `---\ndescription: A spec\n${extra}---\n`;
			await mkdir(join(tempDir, "src", "a"), { recursive: true });
			await mkdir(join(tempDir, "src", "b"), { recursive: true });
			await writeFile(join(tempDir, "index.ts"), "export default function() {}");
			await writeFile(join(tempDir, ".aide"), spec(""));
			await writeFile(join(tempDir, "src", "a", ".aide"), spec("alignment: aligned\n"));
			await writeFile(join(tempDir, "src", "b", ".aide"), spec("status: misaligned\n"));
			await writeFile(
				join(tempDir, "src", "a", "plan.aide"),
				"---\nstatus: approved\nintent: Plan it\n---\n",
			);
			await writeFile(
				join(tempDir, "src", "b", "todo.aide"),
				"---\nstatus: proposed\nintent: Fix it\n---\n",
			);

			const result = await validate(tempDir);
			const alignment = result.warnings.filter(isAlignment);

			expect(alignment).toHaveLength(1);
			expect(alignment[0].kind).toBe("missing-alignment");
			expect(alignment[0].path).toBe(".aide");
		});

		it("respects a scoped path", async () => {
			await mkdir(join(tempDir, "src", "a"), { recursive: true });
			await writeFile(join(tempDir, ".aide"), "---\ndescription: Root spec\n---\n");
			await writeFile(
				join(tempDir, "src", "a", ".aide"),
				"---\ndescription: A spec\nalignment: aligned\n---\n",
			);

			const result = await validate(tempDir, "src/a");

			expect(result.warnings.filter(isAlignment)).toHaveLength(0);
		});
	});

	describe("plan-without-spec", () => {
		const isPlanWithoutSpec = (w: { kind: string }) => w.kind === "plan-without-spec";
		const plan = "---\nstatus: approved\nintent: Plan it\n---\n";

		async function writePlanFolder(name: string, planContent = plan) {
			const dir = join(tempDir, "src", name);
			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, "index.ts"), "export default function() {}");
			await writeFile(join(dir, "plan.aide"), planContent);
			return dir;
		}

		it("flags a plan whose folder has no intent spec", async () => {
			await writePlanFolder("a");

			const result = await validate(tempDir);
			const flagged = result.warnings.filter(isPlanWithoutSpec);

			expect(flagged).toHaveLength(1);
			expect(flagged[0].path).toBe("src/a/plan.aide");
		});

		it("does not flag a plan beside a valid spec", async () => {
			const dir = await writePlanFolder("a");
			await writeFile(join(dir, ".aide"), "---\ndescription: A spec\nalignment: unreviewed\n---\n");

			const result = await validate(tempDir);

			expect(result.warnings.filter(isPlanWithoutSpec)).toHaveLength(0);
		});

		it("respects a scoped path", async () => {
			await writePlanFolder("a");
			await writePlanFolder("b");

			const result = await validate(tempDir, "src/a");

			expect(result.warnings.filter(isPlanWithoutSpec).map((w) => w.path)).toEqual(["src/a/plan.aide"]);
		});

		it("still flags a corrupt plan and keeps scanning other folders", async () => {
			await writePlanFolder("a", "---\nstatus: [unclosed\nintent: : :\n---\n");
			await writePlanFolder("b");

			const result = await validate(tempDir);

			const corrupt = result.warnings.filter((w) => w.path === "src/a/plan.aide").map((w) => w.kind);
			expect(corrupt).toContain("parse-error");
			expect(corrupt).toContain("plan-without-spec");
			expect(result.warnings.filter(isPlanWithoutSpec).map((w) => w.path).sort()).toEqual([
				"src/a/plan.aide",
				"src/b/plan.aide",
			]);
		});
	});

	describe("orphaned-spec", () => {
		const spec = "---\ndescription: A spec\nalignment: unreviewed\n---\n";
		const plan = "---\nstatus: approved\nintent: Plan it\n---\n";
		const isOrphaned = (w: { kind: string }) => w.kind === "orphaned-spec";
		const isPlanWithoutSpec = (w: { kind: string }) => w.kind === "plan-without-spec";

		async function writeSpecFolder(relDir: string, code?: [string, string]) {
			const dir = join(tempDir, ...relDir.split("/"));
			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, ".aide"), spec);
			if (code) await writeFile(join(dir, code[0]), code[1]);
			return dir;
		}

		it("does not flag a shared types folder whose index.ts holds only type exports", async () => {
			await writeSpecFolder("src/types", ["index.ts", "export type Id = string;\n"]);

			const result = await validate(tempDir);

			expect(result.warnings.filter(isOrphaned)).toHaveLength(0);
		});

		it("does not flag a single-file module folder with no index file", async () => {
			await writeSpecFolder("src/script", ["run.mjs", "export default function run() {}\n"]);

			const result = await validate(tempDir);

			expect(result.warnings.filter(isOrphaned)).toHaveLength(0);
		});

		it("flags a folder that holds only a spec", async () => {
			await writeSpecFolder("src/empty");

			const result = await validate(tempDir);
			const orphaned = result.warnings.filter(isOrphaned);

			expect(orphaned).toHaveLength(1);
			expect(orphaned[0].path).toBe("src/empty");
		});

		it("still flags that folder once a plan is added, and does not flag the plan", async () => {
			const dir = await writeSpecFolder("src/empty");
			await writeFile(join(dir, "plan.aide"), plan);

			const result = await validate(tempDir);
			const orphaned = result.warnings.filter(isOrphaned);

			expect(orphaned).toHaveLength(1);
			expect(orphaned[0].path).toBe("src/empty");
			expect(result.warnings.filter(isPlanWithoutSpec)).toHaveLength(0);
		});

		it("does not flag the types folder once a plan is added", async () => {
			const dir = await writeSpecFolder("src/types", ["index.ts", "export type Id = string;\n"]);
			await writeFile(join(dir, "plan.aide"), plan);

			const result = await validate(tempDir);

			expect(result.warnings.filter(isOrphaned)).toHaveLength(0);
		});
	});
});
