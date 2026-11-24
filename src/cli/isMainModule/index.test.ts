import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import isMainModule from "./index.js";

let dir: string;
let file: string;
let other: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "is-main-module-"));
	file = join(dir, "entry.js");
	other = join(dir, "other.js");
	await writeFile(file, "");
	await writeFile(other, "");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("isMainModule", () => {
	it("is true when the entry path is the module file", () => {
		expect(isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath: file })).toBe(true);
	});

	it("is false when the entry path is another existing file", () => {
		expect(isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath: other })).toBe(false);
	});

	it("is false when the entry path is undefined", () => {
		expect(isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath: undefined })).toBe(false);
	});

	it("is false, without throwing, when the entry path does not exist", () => {
		expect(
			isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath: join(dir, "missing.js") }),
		).toBe(false);
	});

	it("resolves a relative entry path against the working directory", () => {
		const entryPath = relative(process.cwd(), file);

		expect(isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath })).toBe(true);
	});

	it.runIf(process.platform === "win32")("ignores letter case on win32", () => {
		expect(
			isMainModule({ moduleUrl: pathToFileURL(file).href, entryPath: file.toUpperCase() }),
		).toBe(true);
	});
});
