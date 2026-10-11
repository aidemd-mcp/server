import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readDraft from "./index.js";

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(path.join(tmpdir(), "read-draft-"));
	await writeFile(path.join(dir, "crlf.aide"), "a: 1\r\nb: 2\r\n");
	await mkdir(path.join(dir, "folder"));
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("readDraft", () => {
	it("reads bytes verbatim, preserving CRLF", async () => {
		const result = await readDraft({ absolutePath: path.join(dir, "crlf.aide"), relativePath: "crlf.aide" });
		expect(result).toEqual({ kind: "read", content: "a: 1\r\nb: 2\r\n" });
	});

	it("reports a missing file as absent", async () => {
		const result = await readDraft({ absolutePath: path.join(dir, "missing.aide"), relativePath: "missing.aide" });
		expect(result).toEqual({ kind: "absent" });
	});

	it("reports a directory as unreadable, naming the relative path and EISDIR", async () => {
		const result = await readDraft({ absolutePath: path.join(dir, "folder"), relativePath: "drafts/folder" });
		expect(result.kind).toBe("unreadable");
		if (result.kind !== "unreadable") return;
		expect(result.reason).toContain("drafts/folder");
		expect(result.reason).toContain("EISDIR");
	});
});
