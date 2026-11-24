import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import loadToken from "./index.js";

const HEX_64 = /^[0-9a-f]{64}$/;

let root: string;
let projectRoot: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "aide-load-token-root-"));
	projectRoot = await mkdtemp(join(tmpdir(), "aide-load-token-project-"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(root, { recursive: true, force: true });
	await rm(projectRoot, { recursive: true, force: true });
});

describe("loadToken", () => {
	it("creates observer-token with 64 lowercase hex characters when the file is missing", async () => {
		const token = await loadToken({ root });
		expect(token).toMatch(HEX_64);
		expect((await readFile(join(root, "observer-token"), "utf-8")).trim()).toBe(token);
	});

	it("returns the same value on the next call", async () => {
		const first = await loadToken({ root });
		expect(await loadToken({ root })).toBe(first);
	});

	it("trims a trailing newline from a valid stored token and keeps it", async () => {
		const stored = "ab".repeat(32);
		await writeFile(join(root, "observer-token"), `${stored}\n`);
		expect(await loadToken({ root })).toBe(stored);
		expect(await readFile(join(root, "observer-token"), "utf-8")).toBe(`${stored}\n`);
	});

	it.each([
		["empty", ""],
		["too short", "ab".repeat(31)],
		["too long", "ab".repeat(33)],
		["uppercase hex", "AB".repeat(32)],
		["non-hex", "zz".repeat(32)],
		["garbage text", "not a token"],
	])("replaces a malformed file (%s) with a fresh token", async (_label, content) => {
		const file = join(root, "observer-token");
		await writeFile(file, content);
		const token = await loadToken({ root });
		expect(token).toMatch(HEX_64);
		expect(token).not.toBe(content.trim());
		expect((await readFile(file, "utf-8")).trim()).toBe(token);
		expect(await loadToken({ root })).toBe(token);
	});

	it("returns one token for two concurrent first calls on an empty folder", async () => {
		const tokens = await Promise.all([loadToken({ root }), loadToken({ root }), loadToken({ root }), loadToken({ root })]);
		expect(new Set(tokens).size).toBe(1);
		expect((await readFile(join(root, "observer-token"), "utf-8")).trim()).toBe(tokens[0]);
	});

	it("leaves nothing but observer-token behind, with no temp file", async () => {
		await Promise.all([loadToken({ root }), loadToken({ root })]);
		await writeFile(join(root, "observer-token"), "bad");
		await loadToken({ root });
		expect(await readdir(root)).toEqual(["observer-token"]);
	});

	it.skipIf(process.platform === "win32")("creates the file with mode 0600", async () => {
		await loadToken({ root });
		expect((await stat(join(root, "observer-token"))).mode & 0o777).toBe(0o600);
	});

	it("throws when the token file cannot be read (a folder in its place) instead of replacing it", async () => {
		await mkdir(join(root, "observer-token"));
		await expect(loadToken({ root })).rejects.toThrow();
	});

	it("keeps the file at the app-data root, never inside a project", async () => {
		vi.stubEnv("LOCALAPPDATA", root);
		vi.stubEnv("XDG_STATE_HOME", root);
		const { root: appRoot } = resolveRoot();
		await mkdir(appRoot, { recursive: true });
		await loadToken({ root: appRoot });
		expect(await readdir(projectRoot)).toEqual([]);
		expect(join(appRoot, "observer-token").startsWith(projectRoot)).toBe(false);
		expect((await stat(join(appRoot, "observer-token"))).isFile()).toBe(true);
	});
});
