import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
vi.mock("@/service/install/shared/checkGlobalPackage/index.js", () => ({
	default: vi.fn(),
}));

import checkGlobalPackage from "@/service/install/shared/checkGlobalPackage/index.js";
import { MCPVAULT_PACKAGE } from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import detectBrainMigration from "@/service/install/provisionBrain/detectBrainMigration/index.js";
import type { BrainChangeTarget } from "@/types/index.js";
import hashBytes from "../shared/hashBytes/index.js";
import locateFrontmatter from "../shared/locateFrontmatter/index.js";
import locateSection from "../shared/locateSection/index.js";
import previewChange from "../previewChange/index.js";
import toLineEnding from "../shared/toLineEnding/index.js";
import applyChange from "./index.js";

const v090 = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
	),
	"utf8",
);
/** The v0.9.0 fixture in CRLF. */
const v090Crlf = toLineEnding({ text: v090, eol: "\r\n" });

const mockCheck = checkGlobalPackage as ReturnType<typeof vi.fn>;

const refusedR9 = (target: string) => ({
	outcome: "refused",
	instructions: `The \`${target}\` text changed after its diff was shown, so nothing was written. Fetch the diff again with \`aide_upgrade\`, \`category: "brain"\` and \`brainChange: "${target}"\` (no \`beforeHash\`), show it to the user, and apply only on their yes.`,
});

describe("applyChange", () => {
	let root: string;
	let brainAidePath: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCheck.mockResolvedValue(true);
		root = await mkdtemp(join(tmpdir(), "apply-change-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
		brainAidePath = join(root, ".aide", "config", "brain.aide");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	const writeFixture = (text: string) => writeFile(brainAidePath, text, "utf-8");
	const readFixture = () => readFile(brainAidePath, "utf-8");

	/** Previews `target` and returns the preview's change, failing the test when none is offered. */
	async function preview(target: BrainChangeTarget) {
		const result = await previewChange({ projectRoot: root, target });
		if (result.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(result)}`);
		return result;
	}

	/** Applies and asserts the file's bytes and mtime did not move. */
	async function applyRefused(target: BrainChangeTarget, beforeHash: string) {
		const bytesBefore = await readFile(brainAidePath);
		const mtimeBefore = (await stat(brainAidePath)).mtimeMs;

		const result = await applyChange({ projectRoot: root, target, beforeHash });

		expect(result.outcome).toBe("refused");
		expect((await readFile(brainAidePath)).equals(bytesBefore)).toBe(true);
		expect((await stat(brainAidePath)).mtimeMs).toBe(mtimeBefore);
		return result;
	}

	for (const [label, fixture, eol] of [
		["LF", v090, "\n"],
		["CRLF", v090Crlf, "\r\n"],
	] as const) {
		it(`applies a previewed stale section on a ${label} file and leaves every other byte alone`, async () => {
			await writeFixture(fixture);
			const change = await preview("orientation");

			expect(await applyChange({ projectRoot: root, target: "orientation", beforeHash: change.beforeHash })).toEqual({
				outcome: "applied",
				target: "orientation",
			});

			const written = await readFixture();
			expect(change.after.split(eol).join("")).not.toMatch(/[\r\n]/);
			const oldSpan = locateSection({ raw: fixture, bodyStart: locateFrontmatter(fixture).bodyStart, marker: "orientation" });
			const newSpan = locateSection({ raw: written, bodyStart: locateFrontmatter(written).bodyStart, marker: "orientation" });
			if (!oldSpan || !newSpan) throw new Error("orientation span not found");
			expect(written.slice(newSpan.start, newSpan.end)).toBe(change.after);
			expect(written.slice(0, newSpan.start)).toBe(fixture.slice(0, oldSpan.start));
			expect(written.slice(newSpan.end)).toBe(fixture.slice(oldSpan.end));
			expect(parseBrainAideFromString(written).kind).toBe(parseBrainAideFromString(fixture).kind);

			// The applied section is now current, so a second preview offers nothing.
			expect(await previewChange({ projectRoot: root, target: "orientation" })).toEqual({
				outcome: "refused",
				instructions:
					"Section `orientation` matches no outdated template version (it is current or customized), so no change is offered.",
			});
		});
	}

	it("applies the launcher on v0.9.0: mcpServerConfig becomes the legacy launcher's after, path arg and body untouched", async () => {
		await writeFixture(v090);
		const expected = detectBrainMigration(parseBrainAideFromString(v090))?.legacyLauncher?.after;
		const change = await preview("launcher");

		expect(await applyChange({ projectRoot: root, target: "launcher", beforeHash: change.beforeHash })).toEqual({
			outcome: "applied",
			target: "launcher",
		});

		const written = await readFixture();
		const parsed = parseBrainAideFromString(written);
		if (parsed.kind !== "ok" && parsed.kind !== "missing-sections") throw new Error(`unexpected parse: ${parsed.kind}`);
		expect(parsed.mcpServerConfig).toEqual(expected);
		expect(written).toContain("    - 'C:\\vault'\n");
		const oldFm = locateFrontmatter(v090);
		const newFm = locateFrontmatter(written);
		expect(written.slice(newFm.bodyStart)).toBe(v090.slice(oldFm.bodyStart));
		expect(written.slice(newFm.yamlStart, newFm.yamlEnd)).toBe(change.after);
	});

	it("applies the launcher on a CRLF file keeping CRLF", async () => {
		await writeFixture(v090Crlf);
		const change = await preview("launcher");

		expect(await applyChange({ projectRoot: root, target: "launcher", beforeHash: change.beforeHash })).toEqual({
			outcome: "applied",
			target: "launcher",
		});

		const written = await readFixture();
		expect(written.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		expect(parseBrainAideFromString(written).kind).toBe(parseBrainAideFromString(v090Crlf).kind);
		const parsed = parseBrainAideFromString(written);
		if (parsed.kind !== "ok" && parsed.kind !== "missing-sections") throw new Error(`unexpected parse: ${parsed.kind}`);
		expect(parsed.mcpServerConfig).toEqual(
			detectBrainMigration(parseBrainAideFromString(v090Crlf))?.legacyLauncher?.after,
		);
	});

	it("refuses the launcher when the brain server is not installed globally, writing nothing", async () => {
		await writeFixture(v090);
		const change = await preview("launcher");
		mockCheck.mockResolvedValue(false);

		const result = await applyRefused("launcher", change.beforeHash);

		expect(mockCheck).toHaveBeenCalledWith(MCPVAULT_PACKAGE);
		expect(result).toEqual({
			outcome: "refused",
			instructions:
				"@bitbonsai/mcpvault is not installed globally, so the brain launcher was not switched and nothing was written. Run `npm i -g @bitbonsai/mcpvault`, confirm it succeeded, then apply this change again with the same beforeHash.",
		});
		expect(await readFixture()).toBe(v090);
	});

	it("checks the global install once for a launcher apply and never for a section apply", async () => {
		await writeFixture(v090);
		const launcher = await preview("launcher");
		await applyChange({ projectRoot: root, target: "launcher", beforeHash: launcher.beforeHash });
		expect(mockCheck).toHaveBeenCalledTimes(1);

		mockCheck.mockClear();
		await writeFixture(v090);
		const section = await preview("orientation");
		await applyChange({ projectRoot: root, target: "orientation", beforeHash: section.beforeHash });
		expect(mockCheck).not.toHaveBeenCalled();
	});

	it("refuses with R9 when whitespace inside the section changed since the preview, keeping the hand edit", async () => {
		await writeFixture(v090);
		const change = await preview("orientation");
		const span = locateSection({ raw: v090, bodyStart: locateFrontmatter(v090).bodyStart, marker: "orientation" });
		if (!span) throw new Error("orientation span not found");
		const edited = v090.slice(0, span.end) + " " + v090.slice(span.end);
		await writeFixture(edited);

		expect(await applyRefused("orientation", change.beforeHash)).toEqual(refusedR9("orientation"));
		expect(await readFixture()).toBe(edited);

		// The staleness fingerprint ignores whitespace, so a fresh preview still offers the change, with a new hash.
		const fresh = await preview("orientation");
		expect(fresh.beforeHash).not.toBe(change.beforeHash);
		expect(fresh.before).toBe(change.before + " ");
	});

	it("refuses a customized section with R5 even when the hash matches", async () => {
		const reworded = v090.replace(/(<!-- aide-config-start -->[\s\S]*?)the/, "$1THE");
		expect(reworded).not.toBe(v090);
		await writeFixture(reworded);
		const current = reworded.slice(
			...(() => {
				const span = locateSection({ raw: reworded, bodyStart: locateFrontmatter(reworded).bodyStart, marker: "config" });
				if (!span) throw new Error("config span not found");
				return [span.start, span.end] as const;
			})(),
		);

		expect(await applyRefused("config", hashBytes(current))).toEqual({
			outcome: "refused",
			instructions:
				"Section `config` matches no outdated template version (it is current or customized), so no change is offered.",
		});
	});

	it("refuses a wrong hash with R9", async () => {
		await writeFixture(v090);

		expect(await applyRefused("orientation", "0".repeat(64))).toEqual(refusedR9("orientation"));
	});

	it("refuses with R9 when the section was removed since the preview", async () => {
		await writeFixture(v090);
		const change = await preview("config");
		const span = locateSection({ raw: v090, bodyStart: locateFrontmatter(v090).bodyStart, marker: "config" });
		if (!span) throw new Error("config span not found");
		const open = v090.lastIndexOf("<!--", span.start);
		const closeEnd = v090.indexOf("-->", span.end) + 3;
		await writeFixture(v090.slice(0, open) + v090.slice(closeEnd));

		expect(await applyRefused("config", change.beforeHash)).toEqual(refusedR9("config"));
	});

	it("refuses an absent file with R1 and creates nothing", async () => {
		const result = await applyChange({ projectRoot: root, target: "orientation", beforeHash: "0".repeat(64) });

		expect(result).toEqual({
			outcome: "refused",
			instructions:
				"No `.aide/config/brain.aide` exists, so nothing was written. Run `/aide:brain config` to create it.",
		});
		await expect(stat(brainAidePath)).rejects.toThrow();
	});

	it("refuses a malformed file with R2 and leaves it untouched", async () => {
		await writeFixture("not frontmatter at all");

		const result = await applyRefused("orientation", "0".repeat(64));

		expect(result.outcome === "refused" && result.instructions).toContain("cannot be changed by the tool");
	});

	it("applies one change per call: other stale sections and the legacy launcher stay as they were", async () => {
		await writeFixture(v090);
		const change = await preview("orientation");

		await applyChange({ projectRoot: root, target: "orientation", beforeHash: change.beforeHash });

		const migration = detectBrainMigration(parseBrainAideFromString(await readFixture()));
		const before = detectBrainMigration(parseBrainAideFromString(v090));
		if (!migration || !before) throw new Error("expected a migration on both files");
		expect(migration.staleSections.map(({ marker }) => marker)).toEqual(
			before.staleSections.map(({ marker }) => marker).filter((marker) => marker !== "orientation"),
		);
		expect(migration.legacyLauncher).not.toBeNull();
		const written = await readFixture();
		expect(written.slice(locateFrontmatter(written).yamlStart, locateFrontmatter(written).yamlEnd)).toBe(
			v090.slice(locateFrontmatter(v090).yamlStart, locateFrontmatter(v090).yamlEnd),
		);
	});
});
