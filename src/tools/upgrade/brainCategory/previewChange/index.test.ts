import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import parseBundledTemplate from "@/service/install/provisionBrain/parseBundledTemplate/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import hashBytes from "../shared/hashBytes/index.js";
import locateFrontmatter from "../shared/locateFrontmatter/index.js";
import previewChange from "./index.js";

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../service/install/provisionBrain/detectBrainMigration/__fixtures__/v0.9.0-brain.txt",
);
const v090 = readFileSync(fixturePath, "utf8");
const template = parseBundledTemplate();

/** The template with one section (wrapped block plus the blank lines after it) removed. */
function templateWithout(marker: BrainSectionMarker): string {
	const { open, close } = toMarkerPair(marker);
	const content = obsidianBrainAideTemplate();
	const start = content.indexOf(open);
	const end = content.indexOf(close) + close.length;
	return content.slice(0, start) + content.slice(end).replace(/^\n+/, "");
}

describe("previewChange", () => {
	let root: string;
	let brainAidePath: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "preview-change-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
		brainAidePath = join(root, ".aide", "config", "brain.aide");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	async function writeFixture(text: string): Promise<void> {
		await writeFile(brainAidePath, text, "utf-8");
	}

	/** Runs the preview and asserts the file's bytes and mtime did not move. */
	async function previewReadOnly(target: Parameters<typeof previewChange>[0]["target"]) {
		const bytesBefore = await readFile(brainAidePath);
		const mtimeBefore = (await stat(brainAidePath)).mtimeMs;

		const result = await previewChange({ projectRoot: root, target });

		expect((await readFile(brainAidePath)).equals(bytesBefore)).toBe(true);
		expect((await stat(brainAidePath)).mtimeMs).toBe(mtimeBefore);
		return result;
	}

	it("previews a stale section with exactly the five change keys and a hash of before", async () => {
		await writeFixture(v090);

		const result = await previewReadOnly("orientation");

		if (result.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(result)}`);
		expect(Object.keys(result).sort()).toEqual(["after", "before", "beforeHash", "outcome", "target"]);
		expect(result.target).toBe("orientation");
		expect(result.after).toBe(template.orientation);
		expect(result.beforeHash).toBe(hashBytes(result.before));
	});

	it("previews the legacy launcher on v0.9.0 as the frontmatter region", async () => {
		await writeFixture(v090);

		const result = await previewReadOnly("launcher");

		if (result.outcome !== "change") throw new Error(`expected a change, got: ${JSON.stringify(result)}`);
		const { yamlStart, yamlEnd } = locateFrontmatter(v090);
		expect(result.target).toBe("launcher");
		expect(result.before).toBe(v090.slice(yamlStart, yamlEnd));
		expect(result.beforeHash).toBe(hashBytes(result.before));
		expect(result.after).not.toBe(result.before);
	});

	it("refuses an absent section under the template launcher with R4 and no template bytes", async () => {
		await writeFixture(templateWithout("kanban-index"));

		const result = await previewReadOnly("kanban-index");

		expect(result).toEqual({
			outcome: "refused",
			instructions:
				"Section `kanban-index` is missing. With the user's consent, insert it with `aide_upgrade` and `category: \"brain\"` (no `brainChange`).",
		});
		expect(JSON.stringify(result)).not.toContain(template.kanbanIndex.trim().slice(0, 40));
	});

	it("returns the bundled template section for an absent section under a non-template launcher", async () => {
		const foreign = templateWithout("kanban-index").replace(
			/@bitbonsai\/mcpvault@[^'"\s]*/,
			"some-other-brain-server",
		);
		expect(foreign).toContain("some-other-brain-server");
		await writeFixture(foreign);

		const result = await previewReadOnly("kanban-index");

		expect(result).toEqual({
			outcome: "missing",
			target: "kanban-index",
			template: template.kanbanIndex,
			instructions:
				"Section `kanban-index` is missing and this config launches a different brain server than the bundled template targets. `template` is the bundled template's version: write a version for this config's brain with the user between that section's markers, then re-check brain state with `aide_info`.",
		});
	});

	it("refuses a customized section with R5", async () => {
		const reworded = v090.replace(/(<!-- aide-config-start -->[\s\S]*?)the/, "$1THE");
		expect(reworded).not.toBe(v090);
		await writeFixture(reworded);

		expect(await previewReadOnly("config")).toEqual({
			outcome: "refused",
			instructions:
				"Section `config` matches no outdated template version (it is current or customized), so no change is offered.",
		});
	});

	it("refuses the launcher when it is current with R7", async () => {
		await writeFixture(obsidianBrainAideTemplate());

		expect(await previewReadOnly("launcher")).toEqual({
			outcome: "refused",
			instructions: "The brain launcher is current or custom, so no launcher change is offered.",
		});
	});

	it("refuses an absent file with R1 and creates nothing", async () => {
		const result = await previewChange({ projectRoot: root, target: "orientation" });

		expect(result).toEqual({
			outcome: "refused",
			instructions:
				"No `.aide/config/brain.aide` exists, so nothing was written. Run `/aide:brain config` to create it.",
		});
		await expect(stat(brainAidePath)).rejects.toThrow();
	});

	it("refuses a malformed file with R2", async () => {
		await writeFixture("not frontmatter at all");

		const result = await previewReadOnly("orientation");

		expect(result.outcome).toBe("refused");
		expect(result.outcome === "refused" && result.instructions).toContain("cannot be changed by the tool");
	});
});
