import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import resolveDraftPath from "./index.js";

let root: string;
let elsewhere: string;
let outsideFile: string;
let symlinkWorks = true;

beforeAll(async () => {
	root = await mkdtemp(path.join(tmpdir(), "draft-root-"));
	elsewhere = await mkdtemp(path.join(tmpdir(), "draft-else-"));
	await mkdir(path.join(root, "drafts"));
	await writeFile(path.join(root, "drafts", "brain.aide"), "x");
	await writeFile(path.join(root, "b.aide"), "x");
	outsideFile = path.join(elsewhere, "outside.aide");
	await writeFile(outsideFile, "x");
	try {
		await symlink(outsideFile, path.join(root, "link.aide"), "file");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "EPERM" && code !== "EACCES") throw err;
		symlinkWorks = false;
	}
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(elsewhere, { recursive: true, force: true });
});

describe("resolveDraftPath", () => {
	it("resolves an inside file with a forward-slash relative path", async () => {
		const resolution = await resolveDraftPath({ root, path: "drafts/brain.aide" });
		expect(resolution.kind).toBe("inside");
		if (resolution.kind !== "inside") return;
		expect(resolution.relativePath).toBe("drafts/brain.aide");
		expect(path.basename(resolution.absolutePath)).toBe("brain.aide");
	});

	it("normalizes a path with a parent segment", async () => {
		const resolution = await resolveDraftPath({ root, path: "a/../b.aide" });
		expect(resolution.kind).toBe("inside");
		if (resolution.kind !== "inside") return;
		expect(resolution.relativePath).toBe("b.aide");
	});

	it("refuses a path that climbs out of the project", async () => {
		expect(await resolveDraftPath({ root, path: "../x.aide" })).toEqual({ kind: "outside" });
	});

	it("refuses an absolute path in another directory", async () => {
		expect(await resolveDraftPath({ root, path: outsideFile })).toEqual({ kind: "outside" });
	});

	it("accepts an absolute path inside the project", async () => {
		const resolution = await resolveDraftPath({ root, path: path.join(root, "drafts", "brain.aide") });
		expect(resolution.kind).toBe("inside");
		if (resolution.kind !== "inside") return;
		expect(resolution.relativePath).toBe("drafts/brain.aide");
	});

	it("reports a missing file inside the project as absent", async () => {
		expect(await resolveDraftPath({ root, path: "drafts/missing.aide" })).toEqual({
			kind: "absent",
			relativePath: "drafts/missing.aide",
		});
	});

	it("refuses a symlink inside the project that points outside it", async ({ skip }) => {
		if (!symlinkWorks) skip();
		expect(await resolveDraftPath({ root, path: "link.aide" })).toEqual({ kind: "outside" });
	});
});
