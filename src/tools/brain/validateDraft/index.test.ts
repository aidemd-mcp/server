import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import classifyParseFailure from "@/service/buildBrainState/classifyParseFailure/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker } from "@/service/brainContract/index.js";
import validateDraft from "./index.js";

const markers = brainContract.map((entry) => entry.marker);

/** The text of one section block, markers included. */
function sectionBlock(template: string, marker: BrainSectionMarker): string {
	const { open, close } = toMarkerPair(marker);
	return template.slice(template.indexOf(open), template.indexOf(close) + close.length);
}

function removeSection(template: string, marker: BrainSectionMarker): string {
	return template.replace(sectionBlock(template, marker), "");
}

/** Swaps the first two contract sections' blocks so the body is out of contract order. */
function swapFirstTwoSections(template: string): string {
	const first = sectionBlock(template, markers[0]!);
	const second = sectionBlock(template, markers[1]!);
	return template.replace(first, "\u0000").replace(second, first).replace("\u0000", second);
}

const bundled = obsidianBrainAideTemplate();
const openOfFirst = toMarkerPair(markers[0]!).open;

const fixtures: Record<string, string> = {
	"bundled template": bundled,
	"one section pair removed": removeSection(bundled, markers[1]!),
	"two section pairs removed": removeSection(removeSection(bundled, markers[1]!), markers[2]!),
	"missing name": bundled.replace(/^name: .*\n/m, ""),
	"deprecated connector field": bundled.replace(/^(name: .*\n)/m, "$1connector: obsidian\n"),
	"unknown marker token": bundled.replace(openOfFirst, openOfFirst.replace("-start", "-begin")),
	"mis-ordered sections": swapFirstTwoSections(bundled),
};

const dirs: string[] = [];

async function makeProject(): Promise<string> {
	const dir = await mkdtemp(path.join(tmpdir(), "validate-draft-"));
	dirs.push(dir);
	return dir;
}

async function writeIn(root: string, relative: string, content: string): Promise<void> {
	await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
	await writeFile(path.join(root, relative), content);
}

afterAll(async () => {
	await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("validateDraft - parity with the host check", () => {
	it.each(Object.entries(fixtures))("%s gives the same verdict as the host check", async (_name, content) => {
		const root = await makeProject();
		await writeIn(root, "drafts/brain.aide", content);
		await writeIn(root, ".aide/config/brain.aide", content);

		const draft = await validateDraft({ root, path: "drafts/brain.aide" });
		const host = await parseBrainAide(root);

		expect(draft.outcome === "valid").toBe(host.kind === "ok");
		if (host.kind === "ok") return;
		expect(draft.outcome).toBe("invalid");
		if (draft.outcome !== "invalid") return;
		expect(draft.fault).toEqual(classifyParseFailure(host));
	});
});

describe("validateDraft - outcomes", () => {
	it("a valid draft's instructions name the draft path", async () => {
		const root = await makeProject();
		await writeIn(root, "drafts/brain.aide", bundled);
		const result = await validateDraft({ root, path: "drafts/brain.aide" });
		expect(result.outcome).toBe("valid");
		expect(result.instructions).toContain("drafts/brain.aide");
	});

	it("gives deep-equal results whether the host config is absent, malformed or valid", async () => {
		const results = [];
		for (const hostConfig of [null, "not a config", bundled]) {
			const root = await makeProject();
			await writeIn(root, "drafts/brain.aide", fixtures["one section pair removed"]!);
			if (hostConfig !== null) await writeIn(root, ".aide/config/brain.aide", hostConfig);
			results.push(await validateDraft({ root, path: "drafts/brain.aide" }));
		}
		expect(results[1]).toEqual(results[0]);
		expect(results[2]).toEqual(results[0]);
	});

	it("reports an absent file as absent", async () => {
		const root = await makeProject();
		const result = await validateDraft({ root, path: "drafts/missing.aide" });
		expect(result.outcome).toBe("absent");
		expect(result.instructions).toContain("drafts/missing.aide");
	});

	it("refuses a path outside the project without echoing it", async () => {
		const root = await makeProject();
		const elsewhere = await makeProject();
		await writeIn(elsewhere, "valid.aide", bundled);
		const absoluteOutside = path.join(elsewhere, "valid.aide");

		for (const outside of ["../outside.aide", absoluteOutside]) {
			const result = await validateDraft({ root, path: outside });
			expect(result.outcome).toBe("refused");
			expect(result.instructions).not.toContain(outside);
			expect(result.instructions).not.toContain("outside.aide");
			expect(result.instructions).not.toContain("valid.aide");
		}
	});

	it("reports a directory path as invalid with a malformed fault naming the path", async () => {
		const root = await makeProject();
		await mkdir(path.join(root, "drafts", "folder"), { recursive: true });
		const result = await validateDraft({ root, path: "drafts/folder" });
		expect(result.outcome).toBe("invalid");
		if (result.outcome !== "invalid") return;
		expect(result.fault.kind).toBe("malformed");
		if (result.fault.kind !== "malformed") return;
		expect(result.fault.reason).toContain("drafts/folder");
	});
});

describe("validateDraft - read-only", () => {
	type Snapshot = Record<string, { bytes: string; mtime: number }>;

	async function snapshot(root: string): Promise<Snapshot> {
		const entries = await readdir(root, { recursive: true, withFileTypes: true });
		const files: Snapshot = {};
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const full = path.join(entry.parentPath, entry.name);
			files[path.relative(root, full)] = {
				bytes: (await readFile(full)).toString("base64"),
				mtime: (await stat(full)).mtimeMs,
			};
		}
		return files;
	}

	let root: string;

	beforeAll(async () => {
		root = await makeProject();
		await writeIn(root, "drafts/valid.aide", bundled);
		await writeIn(root, "drafts/invalid.aide", fixtures["missing name"]!);
		await mkdir(path.join(root, "drafts", "folder"), { recursive: true });
		await writeIn(root, ".aide/config/brain.aide", bundled);
	});

	it.each([
		["valid", "drafts/valid.aide"],
		["invalid", "drafts/invalid.aide"],
		["malformed directory", "drafts/folder"],
		["absent", "drafts/missing.aide"],
		["refused", "../outside.aide"],
	])("leaves the project untouched on a %s outcome", async (_name, draftPath) => {
		const before = await snapshot(root);
		await validateDraft({ root, path: draftPath });
		expect(await snapshot(root)).toEqual(before);
	});
});
