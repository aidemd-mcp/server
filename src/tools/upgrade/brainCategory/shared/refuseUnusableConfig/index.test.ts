import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import type { BrainCategoryResult } from "@/types/index.js";
import readBrainConfig from "../readBrainConfig/index.js";
import refuseUnusableConfig from "./index.js";

const R1 =
	"No `.aide/config/brain.aide` exists, so nothing was written. Run `/aide:brain config` to create it.";

function r2(reason: string): string {
	return `\`.aide/config/brain.aide\` cannot be changed by the tool: ${reason}. Nothing was written. Fix it by hand with the user at the place that reason names, then re-check brain state with \`aide_info\`.`;
}

describe("refuseUnusableConfig", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "refuse-unusable-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	async function refusalFor(content: string | null): Promise<BrainCategoryResult | null> {
		if (content !== null) await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
		const { parse } = await readBrainConfig(root);
		return refuseUnusableConfig(parse);
	}

	it("refuses an absent file with R1 exactly", async () => {
		expect(await refusalFor(null)).toEqual({ outcome: "refused", instructions: R1 });
	});

	it("refuses a directory at the path with R2 carrying the parser's reason", async () => {
		await mkdir(join(root, ".aide", "config", "brain.aide"));
		const { parse } = await readBrainConfig(root);
		if (parse.kind !== "unreadable") throw new Error("fixture must be unreadable");

		const result = refuseUnusableConfig(parse);

		expect(result).toEqual({ outcome: "refused", instructions: r2(parse.reason) });
	});

	it("refuses malformed frontmatter with R2 carrying the parser's reason", async () => {
		const result = await refusalFor("no frontmatter here");

		expect(result).toEqual({ outcome: "refused", instructions: r2("frontmatter is required") });
	});

	it("refuses a half-present marker pair with R2 carrying the parser's reason", async () => {
		const { marker } = brainContract[0]!;
		const { close } = toMarkerPair(marker);
		const raw = obsidianBrainAideTemplate().replace(close, "");
		await writeFile(join(root, ".aide", "config", "brain.aide"), raw, "utf-8");
		const { parse } = await readBrainConfig(root);
		if (parse.kind !== "malformed-body") throw new Error("fixture must be malformed-body");

		const result = refuseUnusableConfig(parse);

		expect(result).toEqual({ outcome: "refused", instructions: r2(parse.reason) });
	});

	it("returns null for an ok file", async () => {
		expect(await refusalFor(obsidianBrainAideTemplate())).toBeNull();
	});

	it("returns null for a missing-sections file", async () => {
		const { marker } = brainContract[0]!;
		const { open, close } = toMarkerPair(marker);
		const raw = obsidianBrainAideTemplate();
		const start = raw.indexOf(open);
		const end = raw.indexOf(close) + close.length;
		const cut = raw.slice(0, start) + raw.slice(end);
		await writeFile(join(root, ".aide", "config", "brain.aide"), cut, "utf-8");
		const { parse } = await readBrainConfig(root);
		expect(parse.kind).toBe("missing-sections");

		expect(refuseUnusableConfig(parse)).toBeNull();
	});

	it("names /aide:brain config only in R1", async () => {
		const text = (result: BrainCategoryResult | null): string => {
			if (!result || result.outcome !== "refused") throw new Error("expected a refusal");
			return result.instructions;
		};
		const missing = await refusalFor(null);
		await mkdir(join(root, ".aide", "config", "brain.aide"));
		const { parse: unreadableParse } = await readBrainConfig(root);
		const unreadable = refuseUnusableConfig(unreadableParse);
		await rm(join(root, ".aide", "config", "brain.aide"), { recursive: true });
		const malformed = await refusalFor("no frontmatter here");

		expect(text(missing)).toContain("/aide:brain config");
		expect(text(unreadable)).not.toContain("/aide:brain config");
		expect(text(malformed)).not.toContain("/aide:brain config");
	});
});
