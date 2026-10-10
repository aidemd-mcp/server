import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import detectBrainMigration from "@/service/install/provisionBrain/detectBrainMigration/index.js";
import type { BrainChangeTarget } from "@/types/index.js";
import brainCategory from "./index.js";
import hashBytes from "./shared/hashBytes/index.js";
import readChangeBefore from "./shared/readChangeBefore/index.js";
import toLineEnding from "./shared/toLineEnding/index.js";

const v090 = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	),
	"utf8",
);
/** The v0.9.0 fixture in CRLF. */
const v090Crlf = toLineEnding({ text: v090, eol: "\r\n" });

describe("brainCategory", () => {
	let root: string;
	let brainAidePath: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "brain-category-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
		brainAidePath = join(root, ".aide", "config", "brain.aide");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	const readFixture = () => readFile(brainAidePath, "utf-8");

	it("walks insert, preview and apply end to end on a v0.9.0 copy", async () => {
		await writeFile(brainAidePath, v090, "utf-8");

		// insert: no brainChange
		const inserted = await brainCategory({ root });
		expect(inserted.outcome).toBe("inserted");
		const afterInsert = await readFixture();
		expect(parseBrainAideFromString(afterInsert).kind).toBe("ok");
		const staleAfterInsert = detectBrainMigration(parseBrainAideFromString(afterInsert));
		expect(staleAfterInsert?.legacyLauncher).toBeTruthy();
		const staleSections = (staleAfterInsert?.staleSections ?? []).map(({ marker }) => marker as BrainChangeTarget);
		expect(staleSections.length).toBeGreaterThan(1);

		// preview: brainChange without beforeHash is read-only
		const target = staleSections[0];
		const preview = await brainCategory({ root, brainChange: target });
		if (preview.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(preview)}`);
		expect(preview.beforeHash).toBe(hashBytes(preview.before));
		expect(await readFixture()).toBe(afterInsert);

		// apply: brainChange with beforeHash migrates only that section
		const applied = await brainCategory({ root, brainChange: target, beforeHash: preview.beforeHash });
		expect(applied).toEqual({ outcome: "applied", target });
		const afterApply = await readFixture();
		const migration = detectBrainMigration(parseBrainAideFromString(afterApply));
		expect(migration?.staleSections.map(({ marker }) => marker)).toEqual(staleSections.slice(1));
		expect(migration?.legacyLauncher).toBeTruthy();

		// the launcher is applied through the same dispatch
		const launcherPreview = await brainCategory({ root, brainChange: "launcher" });
		if (launcherPreview.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(launcherPreview)}`);
		expect(
			await brainCategory({ root, brainChange: "launcher", beforeHash: launcherPreview.beforeHash }),
		).toEqual({ outcome: "applied", target: "launcher" });
		const afterLauncher = await readFixture();
		expect(readChangeBefore({ raw: afterLauncher, target })).not.toBeNull();
		expect(detectBrainMigration(parseBrainAideFromString(afterLauncher))?.legacyLauncher ?? null).toBeNull();
	});

	it("reaches the right action on a CRLF copy", async () => {
		await writeFile(brainAidePath, v090Crlf, "utf-8");

		expect((await brainCategory({ root })).outcome).toBe("inserted");
		const preview = await brainCategory({ root, brainChange: "launcher" });
		if (preview.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(preview)}`);
		expect(
			await brainCategory({ root, brainChange: "launcher", beforeHash: preview.beforeHash }),
		).toEqual({ outcome: "applied", target: "launcher" });
		expect(parseBrainAideFromString(await readFixture()).kind).toBe("ok");
	});

	it("resolves a relative and an absolute path to the same project", async () => {
		await writeFile(brainAidePath, v090, "utf-8");
		const elsewhere = await mkdtemp(join(tmpdir(), "brain-category-root-"));
		try {
			const relativePath = relative(elsewhere, root);
			const viaRelative = await brainCategory({ root: elsewhere, path: relativePath, brainChange: "launcher" });
			const viaAbsolute = await brainCategory({ root: elsewhere, path: root, brainChange: "launcher" });
			expect(viaRelative.outcome).toBe("change");
			expect(viaAbsolute).toEqual(viaRelative);
		} finally {
			await rm(elsewhere, { recursive: true, force: true });
		}
	});
});
