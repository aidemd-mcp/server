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
		await writeFile(join(tempDir, ".aide"), "Clean spec with no links");

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
});
