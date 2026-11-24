import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import writeTemp from "./index.js";

describe("writeTemp", () => {
	let dir: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "observer-writetemp-"));
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("writes the token and a newline to a temp file beside the target", async () => {
		const file = join(dir, "observer-token");
		const temp = await writeTemp({ file, token: "ab".repeat(32) });
		expect(temp.startsWith(`${file}.`)).toBe(true);
		expect(temp.endsWith(".tmp")).toBe(true);
		expect(await readFile(temp, "utf-8")).toBe(`${"ab".repeat(32)}\n`);
		expect((await stat(temp)).isFile()).toBe(true);
	});

	it("returns a different temp path on every call", async () => {
		const file = join(dir, "observer-token");
		const first = await writeTemp({ file, token: "a" });
		const second = await writeTemp({ file, token: "a" });
		expect(first).not.toBe(second);
	});
});
