import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import placeRootIntent from "./index.js";

const TEMPLATE = "template body\n";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), "aide-place-root-intent-"));
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("placeRootIntent", () => {
	it("creates intent.aide from the template in an empty folder", async () => {
		const outcome = await placeRootIntent({ folder, existing: [], template: TEMPLATE });

		expect(outcome).toBe("created");
		expect(await readFile(join(folder, "intent.aide"), "utf-8")).toBe(TEMPLATE);
		expect(await readdir(folder)).toEqual(["intent.aide"]);
	});

	it("renames a bare .aide to intent.aide keeping its bytes", async () => {
		await writeFile(join(folder, ".aide"), "root intent body\n");

		const outcome = await placeRootIntent({
			folder,
			existing: [".aide"],
			template: TEMPLATE,
		});

		expect(outcome).toBe("renamed");
		expect(await readFile(join(folder, "intent.aide"), "utf-8")).toBe("root intent body\n");
		expect(await readdir(folder)).not.toContain(".aide");
	});

	it("leaves both files untouched when .aide and intent.aide are present", async () => {
		await writeFile(join(folder, ".aide"), "bare body\n");
		await writeFile(join(folder, "intent.aide"), "explicit body\n");

		const outcome = await placeRootIntent({
			folder,
			existing: [".aide", "intent.aide"],
			template: TEMPLATE,
		});

		expect(outcome).toBe("exists");
		expect(await readFile(join(folder, ".aide"), "utf-8")).toBe("bare body\n");
		expect(await readFile(join(folder, "intent.aide"), "utf-8")).toBe("explicit body\n");
	});

	it("leaves a lone intent.aide untouched", async () => {
		await writeFile(join(folder, "intent.aide"), "explicit body\n");

		const outcome = await placeRootIntent({
			folder,
			existing: ["intent.aide"],
			template: TEMPLATE,
		});

		expect(outcome).toBe("exists");
		expect(await readFile(join(folder, "intent.aide"), "utf-8")).toBe("explicit body\n");
	});

	it("renames a bare .aide beside research.aide without touching research", async () => {
		await writeFile(join(folder, ".aide"), "root intent body\n");
		await writeFile(join(folder, "research.aide"), "research body\n");

		const outcome = await placeRootIntent({
			folder,
			existing: [".aide", "research.aide"],
			template: TEMPLATE,
		});

		expect(outcome).toBe("renamed");
		expect(await readFile(join(folder, "intent.aide"), "utf-8")).toBe("root intent body\n");
		expect(await readFile(join(folder, "research.aide"), "utf-8")).toBe("research body\n");
	});
});
