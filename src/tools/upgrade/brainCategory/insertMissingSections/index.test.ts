import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate, { MCPVAULT_PACKAGE } from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import locateFrontmatter from "../shared/locateFrontmatter/index.js";
import toLineEnding from "../shared/toLineEnding/index.js";
import insertMissingSections from "./index.js";

const kanbanTail: BrainSectionMarker[] = brainContract
	.map(({ marker }) => marker)
	.filter((marker) => marker.startsWith("kanban-"));

/** The marker-wrapped section (open marker through close marker) as it appears in `text`. */
function wrappedSection(text: string, marker: BrainSectionMarker): string {
	const { open, close } = toMarkerPair(marker);
	return text.slice(text.indexOf(open), text.indexOf(close) + close.length);
}

/** The template with the named sections (wrapped block plus the blank lines after it) removed. */
function templateWithout(markers: BrainSectionMarker[]): string {
	return markers.reduce((content, marker) => {
		const block = wrappedSection(content, marker);
		const start = content.indexOf(block);
		return content.slice(0, start) + content.slice(start + block.length).replace(/^\n+/, "");
	}, obsidianBrainAideTemplate());
}

describe("insertMissingSections", () => {
	let root: string;
	let brainAidePath: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "insert-missing-sections-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
		brainAidePath = join(root, ".aide", "config", "brain.aide");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	async function writeFixture(text: string): Promise<void> {
		await writeFile(brainAidePath, text, "utf-8");
	}

	it("inserts the kanban tail into an LF file, leaving every existing byte before the insertion untouched", async () => {
		const fixture = templateWithout(kanbanTail);
		await writeFixture(fixture);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result).toEqual({ outcome: "inserted", inserted: kanbanTail });
		const written = await readFile(brainAidePath, "utf-8");
		const parse = parseBrainAideFromString(written);
		expect(parse.kind).toBe("ok");

		const template = parseBrainAideFromString(obsidianBrainAideTemplate());
		if (parse.kind !== "ok" || template.kind !== "ok") throw new Error("both parses must be ok");
		for (const { marker, field } of brainContract.filter(({ marker }) => kanbanTail.includes(marker))) {
			expect(parse[field], marker).toBe(template[field]);
		}

		const anchorEnd = fixture.indexOf(toMarkerPair("research-index").close) + toMarkerPair("research-index").close.length;
		expect(written.startsWith(fixture.slice(0, anchorEnd))).toBe(true);
		expect(written.slice(0, locateFrontmatter(written).bodyStart)).toBe(
			fixture.slice(0, locateFrontmatter(fixture).bodyStart),
		);
		expect(written).not.toContain("\r");
		expect(written.trimEnd()).toBe(obsidianBrainAideTemplate().trimEnd());
	});

	it("keeps a CRLF file all-CRLF and inserts the template sections converted to CRLF", async () => {
		const fixture = toLineEnding({ text: templateWithout(kanbanTail), eol: "\r\n" });
		await writeFixture(fixture);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result).toEqual({ outcome: "inserted", inserted: kanbanTail });
		const written = await readFile(brainAidePath, "utf-8");
		expect(written.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		expect(parseBrainAideFromString(written).kind).toBe("ok");
		expect(written.trimEnd()).toBe(toLineEnding({ text: obsidianBrainAideTemplate(), eol: "\r\n" }).trimEnd());
	});

	it("places a missing first section after the frontmatter with a blank line between", async () => {
		const fixture = templateWithout(["orientation"]);
		await writeFixture(fixture);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result).toEqual({ outcome: "inserted", inserted: ["orientation"] });
		const written = await readFile(brainAidePath, "utf-8");
		const { bodyStart } = locateFrontmatter(written);
		expect(written.slice(bodyStart).startsWith("\n" + toMarkerPair("orientation").open)).toBe(true);
		expect(parseBrainAideFromString(written).kind).toBe("ok");
	});

	it("is a no-op on re-run: empty manifest and identical bytes", async () => {
		await writeFixture(templateWithout(kanbanTail));
		await insertMissingSections({ projectRoot: root });
		const afterFirst = await readFile(brainAidePath, "utf-8");
		const mtime = (await stat(brainAidePath)).mtimeMs;

		const result = await insertMissingSections({ projectRoot: root });

		expect(result).toEqual({ outcome: "inserted", inserted: [] });
		expect(await readFile(brainAidePath, "utf-8")).toBe(afterFirst);
		expect((await stat(brainAidePath)).mtimeMs).toBe(mtime);
	});

	it("returns adapt without writing when the launcher is not the template's integration", async () => {
		const fixture = templateWithout(kanbanTail).replaceAll(MCPVAULT_PACKAGE, "other-brain-server");
		await writeFixture(fixture);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result.outcome).toBe("adapt");
		if (result.outcome !== "adapt") throw new Error("expected adapt");
		expect(result.adapt).toEqual(kanbanTail);
		expect(result.instructions).toContain("aide-brain-author");
		expect(result.instructions).toContain("`brainChange`");
		expect(result.instructions).not.toContain("/aide:brain config");
		expect(await readFile(brainAidePath, "utf-8")).toBe(fixture);
	});

	it("refuses with R1 when the file is absent and creates nothing", async () => {
		const result = await insertMissingSections({ projectRoot: root });

		expect(result.outcome).toBe("refused");
		if (result.outcome !== "refused") throw new Error("expected refused");
		expect(result.instructions).toContain("No `.aide/config/brain.aide` exists");
		await expect(stat(brainAidePath)).rejects.toThrow();
	});

	it("refuses with R2 when the file is malformed and leaves it unchanged", async () => {
		const { open } = toMarkerPair("config");
		const malformed = templateWithout(["kanban-review"]).replace(toMarkerPair("config").close, "");
		expect(malformed).toContain(open);
		await writeFixture(malformed);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result.outcome).toBe("refused");
		if (result.outcome !== "refused") throw new Error("expected refused");
		expect(result.instructions).toContain("cannot be changed by the tool");
		expect(await readFile(brainAidePath, "utf-8")).toBe(malformed);
	});

	it("leaves a customized present section and a stale-looking present section byte-identical", async () => {
		const customized = obsidianBrainAideTemplate().replace("Your brain is", "Our team brain is");
		const fixture = customized.replace(
			wrappedSection(customized, "kanban-review"),
			"",
		);
		await writeFixture(fixture);

		const result = await insertMissingSections({ projectRoot: root });

		expect(result).toEqual({ outcome: "inserted", inserted: ["kanban-review"] });
		const written = await readFile(brainAidePath, "utf-8");
		expect(wrappedSection(written, "orientation")).toBe(wrappedSection(fixture, "orientation"));
		expect(wrappedSection(written, "orientation")).toContain("Our team brain is");
		const closeEnd = fixture.indexOf(toMarkerPair("kanban-stash").close) + toMarkerPair("kanban-stash").close.length;
		expect(written.startsWith(fixture.slice(0, closeEnd))).toBe(true);
	});

	it("never carries template section text in the result", async () => {
		await writeFixture(templateWithout(kanbanTail));

		const result = await insertMissingSections({ projectRoot: root });

		const template = parseBrainAideFromString(obsidianBrainAideTemplate());
		if (template.kind !== "ok") throw new Error("template must parse ok");
		const serialized = JSON.stringify(result);
		for (const { field } of brainContract) {
			expect(serialized).not.toContain(JSON.stringify(template[field]).slice(1, 80));
		}
		expect(Object.keys(result)).toEqual(["outcome", "inserted"]);
	});
});
