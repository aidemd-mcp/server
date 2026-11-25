import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "jsonc-parser";
import aideHookEntries, { AIDE_HOOK_COMMAND } from "@/service/install/shared/planHooksMerge/aideHookEntries/index.js";
import applyFiles from "../applyFiles/index.js";
import checkHooksConfig from "./index.js";

let projectRoot: string;
let settingsPath: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "aide-hooks-upgrade-"));
	settingsPath = join(projectRoot, ".claude", "settings.json");
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

const writeSettings = async (text: string) => {
	await mkdir(join(projectRoot, ".claude"), { recursive: true });
	await writeFile(settingsPath, text, "utf-8");
};

const detect = async () => {
	const [file] = await checkHooksConfig({ projectRoot, framework: "claude" });
	return file;
};

const count = (text: string, needle: string) => text.split(needle).length - 1;

const aideEvents = aideHookEntries.map(({ event }) => event);

/** Settings wiring every AIDE event except `without`. */
const partialSettings = (without: string[], eol = "\n") =>
	JSON.stringify(
		{
			model: "opus",
			hooks: Object.fromEntries(
				aideHookEntries
					.filter(({ event }) => !without.includes(event))
					.map(({ event, group }) => [event, [group]]),
			),
		},
		null,
		2,
	).replace(/\n/g, eol);

describe("checkHooksConfig: framework gate", () => {
	it.each(["cursor", "windsurf", "copilot"] as const)("returns [] for %s and reads nothing", async (framework) => {
		await writeSettings("{ not json");
		expect(await checkHooksConfig({ projectRoot, framework })).toEqual([]);
	});
});

describe("checkHooksConfig: detection", () => {
	it("absent file: missing, with the full new file as canonicalContent", async () => {
		const file = await detect();
		expect(file).toMatchObject({
			name: "Claude Code hooks",
			filePath: settingsPath,
			status: "missing",
			category: "hooks",
		});
		expect(Object.keys(JSON.parse(file.canonicalContent!).hooks)).toEqual(aideEvents);
	});

	it("file lacking some events: differs, with the merge as canonicalContent", async () => {
		await writeSettings(partialSettings([aideEvents[0]]));
		const file = await detect();
		expect(file.status).toBe("differs");
		expect(file.category).toBe("hooks");
		expect(file.filePath).toBe(settingsPath);
		expect(Object.keys(parse(file.canonicalContent!).hooks)).toContain(aideEvents[0]);
	});

	it("every event wired: matches, with no canonicalContent", async () => {
		await writeSettings(partialSettings([]));
		const file = await detect();
		expect(file.status).toBe("matches");
		expect(file.canonicalContent).toBeUndefined();
	});

	it("unparseable file: malformed, with no canonicalContent", async () => {
		await writeSettings("{ \"hooks\": ");
		const file = await detect();
		expect(file.status).toBe("malformed");
		expect(file.canonicalContent).toBeUndefined();
	});

	it("detection writes nothing", async () => {
		const text = partialSettings([aideEvents[0]]);
		await writeSettings(text);
		await detect();
		expect(await readFile(settingsPath, "utf-8")).toBe(text);
	});

	it("detection does not create the settings file when absent", async () => {
		await detect();
		await expect(readFile(settingsPath, "utf-8")).rejects.toThrow();
	});
});

describe("checkHooksConfig: applied through applyFiles", () => {
	it("creates the file when absent, then a second detection matches", async () => {
		const [applied] = await applyFiles([(await detect())!]);
		expect(applied.status).toBe("created");
		expect(applied.canonicalContent).toBeUndefined();
		expect((await detect())!.status).toBe("matches");
	});

	it("adds only AIDE's missing groups and keeps every other byte", async () => {
		const original = `{\r\n  // my settings\r\n  "model": "opus",\r\n  "hooks": {\r\n    "Stop": [\r\n      { "hooks": [{ "type": "command", "command": "echo mine" }] }\r\n    ]\r\n  },\r\n  "env": { "A": "1" }\r\n}\r\n`;
		await writeSettings(original);

		const [applied] = await applyFiles([(await detect())!]);
		expect(applied.status).toBe("updated");

		const merged = await readFile(settingsPath, "utf-8");
		// Nothing of the user's text moved: the original is the merge with only inserted ranges removed.
		for (const line of original.split("\r\n").filter((l) => l !== "")) {
			expect(merged).toContain(line);
		}
		expect(merged).toContain("// my settings");
		expect(merged).toContain("echo mine");
		expect(merged).not.toMatch(/[^\r]\n/);
		const settings = parse(merged);
		expect(settings.model).toBe("opus");
		expect(settings.env).toEqual({ A: "1" });
		for (const { event } of aideHookEntries) expect(Array.isArray(settings.hooks[event])).toBe(true);
		expect((await detect())!.status).toBe("matches");
	});

	it("never adds an entry twice: applying a second time changes nothing", async () => {
		await writeSettings(partialSettings([aideEvents[0]]));
		await applyFiles([(await detect())!]);
		const once = await readFile(settingsPath, "utf-8");
		const [second] = await applyFiles([(await detect())!]);
		expect(second.status).toBe("unchanged");
		expect(await readFile(settingsPath, "utf-8")).toBe(once);
		expect(count(once, AIDE_HOOK_COMMAND)).toBe(aideEvents.length);
	});

	it("merges from the file's current bytes when it was edited after an earlier detection", async () => {
		await writeSettings(partialSettings([aideEvents[0]]));
		await detect();
		const edited = `${partialSettings([aideEvents[0]]).replace('"model": "opus"', '"model": "sonnet"')}\n`;
		await writeSettings(edited);

		await applyFiles([(await detect())!]);

		const merged = await readFile(settingsPath, "utf-8");
		expect(parse(merged).model).toBe("sonnet");
		expect(count(merged, AIDE_HOOK_COMMAND)).toBe(aideEvents.length);
	});

	it("never writes a malformed file", async () => {
		const broken = "{ \"hooks\": [";
		await writeSettings(broken);
		const [applied] = await applyFiles([(await detect())!]);
		expect(applied.status).toBe("malformed");
		expect(await readFile(settingsPath, "utf-8")).toBe(broken);
	});
});
