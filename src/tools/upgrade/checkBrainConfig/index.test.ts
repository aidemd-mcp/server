import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import checkBrainConfig from "./index.js";

const FRONTMATTER = "---\nname: obsidian\nmcpServerConfig:\n  command: npx\n  args:\n    - launcher\n---\n";

/** Builds brain.aide bytes with one marker pair per contract entry, omitting `omit`. */
function buildBrainAide(omit: BrainSectionMarker[] = []): string {
	const blocks = brainContract
		.filter((entry) => !omit.includes(entry.marker))
		.map((entry) => {
			const { open, close } = toMarkerPair(entry.marker);
			return `${open}\nbody of ${entry.marker}\n${close}\n`;
		});
	return FRONTMATTER + "\n" + blocks.join("\n");
}

let root: string;

async function writeBrain(content: string): Promise<void> {
	await mkdir(join(root, ".aide", "config"), { recursive: true });
	await writeFile(join(root, ".aide", "config", "brain.aide"), content, "utf-8");
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "check-brain-config-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("checkBrainConfig", () => {
	it("maps an ok parse to matches", async () => {
		await writeBrain(buildBrainAide());
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("matches");
		expect(result.category).toBe("brain");
		expect(result.name).toBe(".aide/config/brain.aide");
		expect(result.filePath).toBe(join(root, ".aide", "config", "brain.aide"));
		expect(result.missingSections).toBeUndefined();
		expect(result.canonicalContent).toBeUndefined();
	});

	it("maps an absent file to missing", async () => {
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("missing");
		expect(result.canonicalContent).toBeUndefined();
	});

	it("maps a behind config to differs and names the missing sections in contract order", async () => {
		await writeBrain(buildBrainAide(["kanban-board", "kanban-index"]));
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("differs");
		expect(result.missingSections).toEqual(["kanban-board", "kanban-index"]);
		expect(result.canonicalContent).toBeUndefined();
	});

	it("maps malformed frontmatter to malformed", async () => {
		await writeBrain("no frontmatter here\n");
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("malformed");
		expect(result.canonicalContent).toBeUndefined();
	});

	it("maps a present-but-unreadable brain.aide to malformed, never missing", async () => {
		await mkdir(join(root, ".aide", "config", "brain.aide"), { recursive: true });
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("malformed");
		expect(result.canonicalContent).toBeUndefined();
	});

	it("maps a malformed body to malformed", async () => {
		await writeBrain(buildBrainAide() + "\n<!-- aide-orientaton-start -->\n");
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("malformed");
		expect(result.canonicalContent).toBeUndefined();
	});
});
