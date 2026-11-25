import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, platform: vi.fn(() => actual.platform()), homedir: vi.fn(() => actual.homedir()) };
});

import { platform, homedir } from "node:os";
import moveLegacyRoot from "./index.js";

const mockPlatform = vi.mocked(platform);
const mockHomedir = vi.mocked(homedir);

const ACTUAL_PLATFORM = platform();

let sandbox: string;
let legacyRoot: string;
let newRoot: string;

/** Factory: seed one legacy project folder with one file in each of the four folders; returns their paths relative to a root. */
async function seedProject(key: string, tag: string): Promise<string[]> {
	const files = [
		["events", `${tag}-e.jsonl`, `${tag} events\n`],
		["archive", `${tag}-a.jsonl`, `${tag} archive\n`],
		["presence", `${tag}-p.json`, `{"tag":"${tag}"}`],
		["ended", `${tag}-x.json`, `{"ended":"${tag}"}`],
	] as const;
	for (const [folder, name, content] of files) {
		await mkdir(path.join(legacyRoot, key, folder), { recursive: true });
		await writeFile(path.join(legacyRoot, key, folder, name), content);
	}
	return files.map(([folder, name]) => path.join(key, folder, name));
}

beforeEach(async () => {
	sandbox = await mkdtemp(path.join(tmpdir(), "aide-moveroot-"));
	const localAppData = path.join(sandbox, "Local");
	legacyRoot = path.join(localAppData, "aidemd");
	newRoot = path.join(sandbox, "home", ".aidemd");
	await mkdir(legacyRoot, { recursive: true });
	mockPlatform.mockReturnValue(ACTUAL_PLATFORM);
	mockHomedir.mockReturnValue(path.join(sandbox, "home"));
	vi.stubEnv("AIDEMD_HOME", "");
	vi.stubEnv("LOCALAPPDATA", localAppData);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(sandbox, { recursive: true, force: true });
});

describe.runIf(ACTUAL_PLATFORM === "win32")("moveLegacyRoot", () => {
	it("moves a full legacy root of two projects and cleans up after itself", async () => {
		const alpha = await seedProject("alpha-3f9a2c", "alpha");
		const zeta = await seedProject("zeta-aaaaaa", "zeta");
		await writeFile(path.join(legacyRoot, "observer.json"), "{}");
		await writeFile(path.join(legacyRoot, "observer-token"), "token");
		await writeFile(path.join(legacyRoot, "unknown.txt"), "stay");

		const result = await moveLegacyRoot();

		expect(result).toEqual({ outcome: "moved", legacyRoot, moved: 8, superseded: 0, left: [] });
		for (const relative of [...alpha, ...zeta]) {
			expect(existsSync(path.join(newRoot, relative))).toBe(true);
			expect(existsSync(path.join(legacyRoot, relative))).toBe(false);
		}
		expect(await readFile(path.join(newRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"), "utf8")).toBe("alpha events\n");
		expect(existsSync(path.join(legacyRoot, "observer.json"))).toBe(false);
		expect(existsSync(path.join(legacyRoot, "observer-token"))).toBe(false);
		expect(await readdir(legacyRoot)).toEqual(["unknown.txt"]);
	});

	it("removes the legacy root when nothing else is left in it, and a second run answers none", async () => {
		await seedProject("alpha-3f9a2c", "alpha");
		await writeFile(path.join(legacyRoot, "observer.json"), "{}");

		expect((await moveLegacyRoot()).outcome).toBe("moved");
		expect(existsSync(legacyRoot)).toBe(false);
		expect(await moveLegacyRoot()).toEqual({ outcome: "none" });
	});

	it("answers none for an absent legacy root", async () => {
		await rm(legacyRoot, { recursive: true });
		expect(await moveLegacyRoot()).toEqual({ outcome: "none" });
	});

	it("reports a token that cannot be deleted as left/error and still completes the move", async () => {
		await seedProject("alpha-3f9a2c", "alpha");
		await mkdir(path.join(legacyRoot, "observer-token"));

		const result = await moveLegacyRoot();

		expect(result).toMatchObject({ outcome: "moved", moved: 4, superseded: 0 });
		if (result.outcome !== "moved") throw new Error("expected a move");
		expect(result.left).toHaveLength(1);
		expect(result.left[0]).toMatchObject({ path: path.join(legacyRoot, "observer-token"), reason: "error" });
		expect(existsSync(path.join(newRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"))).toBe(true);
	});

	it("merges into a destination that already holds the project, never overwriting a different log", async () => {
		await seedProject("alpha-3f9a2c", "alpha");
		const events = path.join(newRoot, "alpha-3f9a2c", "events");
		await mkdir(events, { recursive: true });
		await writeFile(path.join(events, "alpha-e.jsonl"), "different\n");
		await writeFile(path.join(events, "other.jsonl"), "kept\n");

		const result = await moveLegacyRoot();

		expect(result).toMatchObject({ outcome: "moved", moved: 3, superseded: 0 });
		if (result.outcome !== "moved") throw new Error("expected a move");
		expect(result.left).toEqual([
			{ path: path.join(legacyRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"), reason: "diverged" },
		]);
		expect(await readFile(path.join(events, "alpha-e.jsonl"), "utf8")).toBe("different\n");
		expect(await readFile(path.join(legacyRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"), "utf8")).toBe("alpha events\n");
		expect(await readFile(path.join(events, "other.jsonl"), "utf8")).toBe("kept\n");
	});

	it("moves every file once when two runs start together, with nothing left behind", async () => {
		const alpha = await seedProject("alpha-3f9a2c", "alpha");
		const zeta = await seedProject("zeta-aaaaaa", "zeta");

		const results = await Promise.all([moveLegacyRoot(), moveLegacyRoot()]);

		for (const result of results) {
			if (result.outcome === "moved") expect(result.left).toEqual([]);
		}
		for (const relative of [...alpha, ...zeta]) {
			expect(existsSync(path.join(newRoot, relative))).toBe(true);
		}
		const moved = results.reduce((sum, result) => sum + (result.outcome === "moved" ? result.moved : 0), 0);
		expect(moved).toBeGreaterThanOrEqual(1);
		expect(existsSync(legacyRoot)).toBe(false);
	});
});

describe("moveLegacyRoot off the move path", () => {
	it("answers none on a non-Windows platform without touching the legacy folder", async () => {
		await seedProject("alpha-3f9a2c", "alpha");
		mockPlatform.mockReturnValue("linux");
		expect(await moveLegacyRoot()).toEqual({ outcome: "none" });
		expect(existsSync(path.join(legacyRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"))).toBe(true);
	});

	it("answers none under an AIDEMD_HOME override without touching the legacy folder", async () => {
		await seedProject("alpha-3f9a2c", "alpha");
		vi.stubEnv("AIDEMD_HOME", path.join(sandbox, "isolated"));
		expect(await moveLegacyRoot()).toEqual({ outcome: "none" });
		expect(existsSync(path.join(legacyRoot, "alpha-3f9a2c", "events", "alpha-e.jsonl"))).toBe(true);
		expect(existsSync(path.join(sandbox, "isolated"))).toBe(false);
	});
});
