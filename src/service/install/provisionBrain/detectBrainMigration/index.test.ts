import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { ParseBrainAideResult } from "@/types/index.js";
import obsidianBrainAideTemplate, { MCPVAULT_VERSION } from "../obsidianBrainAideTemplate/index.js";
import detectBrainMigration from "./index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const readFixture = (name: string): string => readFileSync(join(fixturesDir, name), "utf8");
const detect = (text: string) => detectBrainMigration(parseBrainAideFromString(text));
const staleMarkers = (text: string) => detect(text)?.staleSections.map((offer) => offer.marker);

const v090 = readFixture("v0.9.0-brain.txt");
const repo = readFixture("aidemd-repo-2026-10-09-brain.txt");
const frontmatterEnd = (text: string) => text.indexOf("\n---", 4) + "\n---".length;

describe("detectBrainMigration", () => {
	it("flags the v0.9.0 fixture's stale sections and its legacy launcher", () => {
		const migration = detect(v090)!;
		expect(migration.staleSections.map((o) => o.marker)).toEqual(["orientation", "config"]);
		const launcher = migration.legacyLauncher!;
		expect(launcher.reasons).toEqual(["unpinned", "missing-auto-confirm"]);
		expect(launcher.before).toEqual({ command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", "C:\\vault"] });
		expect(launcher.after.local).toEqual({
			command: "cmd",
			args: ["/c", "npx", "-y", `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`, "C:\\vault"],
		});
		expect(launcher.after.global).toEqual({ command: "mcpvault", args: ["C:\\vault"] });
	});

	it("flags the repo fixture's eleven stale sections and leaves its global launcher alone", () => {
		const migration = detect(repo)!;
		expect(migration.staleSections.map((o) => o.marker)).toEqual([
			"orientation",
			"config",
			"update-playbook",
			// The repo copy predates the "card" → "task" rename, so its kanban sections are outdated too.
			"kanban-index",
			"kanban-create",
			"kanban-work",
			"kanban-manage",
			"kanban-move",
			"kanban-complete",
			"kanban-stash",
			"kanban-review",
		]);
		expect(migration.legacyLauncher).toBeNull();
	});

	it("never flags a customized config section", () => {
		const reworded = v090.replace(/(<!-- aide-config-start -->[\s\S]*?)the/, "$1THE");
		expect(reworded).not.toBe(v090);
		expect(staleMarkers(reworded)).toEqual(["orientation"]);
	});

	it("handles the POSIX launcher variant", () => {
		const posix = `---\nname: obsidian\nmcpServerConfig:\n  command: npx\n  args:\n    - '@bitbonsai/mcpvault'\n    - '/home/u/vault'\n---${v090.slice(frontmatterEnd(v090))}`;
		const migration = detect(posix)!;
		expect(migration.staleSections.map((o) => o.marker)).toEqual(["orientation", "config"]);
		expect(migration.legacyLauncher!.after.local).toEqual({
			command: "npx",
			args: ["-y", `@bitbonsai/mcpvault@${MCPVAULT_VERSION}`, "/home/u/vault"],
		});
	});

	it.each(["local", "global"] as const)("returns null for the current template (%s)", (mode) => {
		expect(detect(obsidianBrainAideTemplate(mode))).toBeNull();
	});

	it.each(["missing", "unreadable", "malformed-frontmatter", "malformed-body"])("returns null for %s", (kind) => {
		expect(detectBrainMigration({ kind } as ParseBrainAideResult)).toBeNull();
	});

	it("is read-only because it is synchronous and its source imports no fs", () => {
		expect(detect(v090)).not.toBeInstanceOf(Promise);
		const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");
		expect(source).not.toMatch(/node:fs|from "fs"/);
	});
});
