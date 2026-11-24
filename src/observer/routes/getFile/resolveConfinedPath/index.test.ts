import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import resolveConfinedPath from "./index.js";

const isWindows = process.platform === "win32";

let sandbox: string;
let projectRoot: string;
let outsideFolder: string;

beforeEach(async () => {
	sandbox = await realpath(await mkdtemp(join(tmpdir(), "aide-confine-")));
	projectRoot = join(sandbox, "project");
	outsideFolder = join(sandbox, "outside");
	await mkdir(join(projectRoot, "sub"), { recursive: true });
	await mkdir(outsideFolder);
	await writeFile(join(projectRoot, "a.txt"), "hello");
	await writeFile(join(outsideFolder, "secret.txt"), "secret");
	await writeFile(join(sandbox, "x"), "sibling file");
});

afterEach(async () => {
	await rm(sandbox, { recursive: true, force: true });
});

describe("resolveConfinedPath — accepted", () => {
	it("serves a file inside the root with its project-relative path", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "a.txt" })).toEqual({
			kind: "ok",
			file: join(projectRoot, "a.txt"),
			relativePath: "a.txt",
		});
	});

	it("serves sub/../a.txt as a.txt", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "sub/../a.txt" })).toMatchObject({
			kind: "ok",
			relativePath: "a.txt",
		});
	});

	it("joins nested relative paths with a forward slash", async () => {
		await writeFile(join(projectRoot, "sub", "b.txt"), "b");
		expect(await resolveConfinedPath({ projectRoot, requested: "sub/b.txt" })).toMatchObject({
			kind: "ok",
			relativePath: "sub/b.txt",
		});
	});
});

describe("resolveConfinedPath — refused", () => {
	it.each(["../x", "..\\x", "sub/../../x"])("refuses %s", async (requested) => {
		expect(await resolveConfinedPath({ projectRoot, requested })).toEqual({ kind: "refused" });
	});

	it("refuses the absolute path of a file in a sibling folder", async () => {
		const requested = join(outsideFolder, "secret.txt");
		expect(await resolveConfinedPath({ projectRoot, requested })).toEqual({ kind: "refused" });
	});

	it.runIf(isWindows)("refuses a path on another drive letter and the Windows folder", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "Z:\\x" })).toEqual({ kind: "refused" });
		expect(await resolveConfinedPath({ projectRoot, requested: "C:\\Windows\\win.ini" })).toEqual({
			kind: "refused",
		});
	});

	it.runIf(!isWindows)("refuses /etc/passwd and a drive-letter path", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "/etc/passwd" })).toEqual({ kind: "refused" });
		expect(await resolveConfinedPath({ projectRoot, requested: "C:\\Windows\\win.ini" })).toEqual({
			kind: "refused",
		});
	});

	it.each(["\\\\server\\share\\x", "//server/share/x", "\\\\?\\C:\\x"])("refuses the UNC or device path %s", async (requested) => {
		expect(await resolveConfinedPath({ projectRoot, requested })).toEqual({ kind: "refused" });
	});

	it.each([".", "relative/dir", "../x", ""])("refuses the non-absolute project root %j", async (relativeRoot) => {
		// package.json exists in the test process's working folder, so a relative root would serve it.
		expect(await resolveConfinedPath({ projectRoot: relativeRoot, requested: "package.json" })).toEqual({
			kind: "refused",
		});
	});

	it("refuses a NUL byte", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "a.txt\0.png" })).toEqual({ kind: "refused" });
	});

	it("refuses a file reached through a junction that points outside the project", async () => {
		await symlink(outsideFolder, join(projectRoot, "link"), "junction");
		expect(await resolveConfinedPath({ projectRoot, requested: "link/secret.txt" })).toEqual({
			kind: "refused",
		});
	});
});

describe("resolveConfinedPath — not served", () => {
	it("reports a missing file", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "nope.txt" })).toEqual({ kind: "missing" });
	});

	it("reports a path below a file as missing", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "a.txt/deeper" })).toEqual({ kind: "missing" });
	});

	it("reports a folder as not a file", async () => {
		expect(await resolveConfinedPath({ projectRoot, requested: "sub" })).toEqual({ kind: "not-a-file" });
	});
});
