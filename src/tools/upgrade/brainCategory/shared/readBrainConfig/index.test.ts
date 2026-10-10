import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import parseBrainAide, { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import readBrainConfig from "./index.js";

describe("readBrainConfig", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "read-brain-config-"));
		await mkdir(join(root, ".aide", "config"), { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("returns the raw bytes and their in-memory parse when the file reads", async () => {
		const raw = obsidianBrainAideTemplate();
		await writeFile(join(root, ".aide", "config", "brain.aide"), raw, "utf-8");

		const result = await readBrainConfig(root);

		expect(result.raw).toBe(raw);
		expect(result.parse).toEqual(parseBrainAideFromString(raw));
		expect(result.parse.kind).toBe("ok");
	});

	it("keeps CRLF bytes exactly as read", async () => {
		const raw = obsidianBrainAideTemplate().replace(/\n/g, "\r\n");
		await writeFile(join(root, ".aide", "config", "brain.aide"), raw, "utf-8");

		const result = await readBrainConfig(root);

		expect(result.raw).toBe(raw);
	});

	it("returns raw null and the parser's missing result for an absent file", async () => {
		const result = await readBrainConfig(root);

		expect(result.raw).toBeNull();
		expect(result.parse).toEqual({ kind: "missing" });
		expect(result.parse).toEqual(await parseBrainAide(root));
	});

	it("returns raw null and the parser's unreadable result for a directory at the path", async () => {
		await mkdir(join(root, ".aide", "config", "brain.aide"));

		const result = await readBrainConfig(root);

		expect(result.raw).toBeNull();
		expect(result.parse.kind).toBe("unreadable");
		expect(result.parse).toEqual(await parseBrainAide(root));
	});

	it("parses a malformed file in memory and still returns its raw bytes", async () => {
		await writeFile(join(root, ".aide", "config", "brain.aide"), "no frontmatter here", "utf-8");

		const result = await readBrainConfig(root);

		expect(result.raw).toBe("no frontmatter here");
		expect(result.parse.kind).toBe("malformed-frontmatter");
	});
});
