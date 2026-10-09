import { describe, it, expect, vi, beforeEach } from "vitest";

const reader = vi.hoisted(() => ({ override: null as null | (() => string) }));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		// Real read unless a test installs an override.
		readFileSync: (...args: Parameters<typeof actual.readFileSync>) =>
			reader.override ? reader.override() : actual.readFileSync(...args),
	};
});

import { join } from "node:path";
import { readFileSync } from "node:fs";
import readAidePackageVersion from "./index.js";

beforeEach(() => {
	reader.override = null;
});

describe("readAidePackageVersion", () => {
	it("returns the repo package.json version", () => {
		const expected = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")).version;

		expect(readAidePackageVersion()).toBe(expected);
	});

	it("throws the exact error shape when the read fails", () => {
		reader.override = () => {
			throw new Error("boom");
		};

		expect(() => readAidePackageVersion()).toThrow(
			/^cannot read @aidemd-mcp\/server version from .*package\.json: boom$/,
		);
	});

	it("throws when package.json has no string version", () => {
		reader.override = () => JSON.stringify({ version: 9 });

		expect(() => readAidePackageVersion()).toThrow(/no string `version` field$/);
	});
});
