import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/service/install/provisionBrain/index.js", () => ({
	readBrainMigrationNotice: vi.fn(),
}));

import brainContract from "@/service/brainContract/index.js";
import toMarkerPair from "@/service/brainContract/toMarkerPair/index.js";
import { readBrainMigrationNotice } from "@/service/install/provisionBrain/index.js";
import type { BrainSectionMarker } from "@/types/index.js";
import checkBrainConfig from "./index.js";

const mockNotice = vi.mocked(readBrainMigrationNotice);

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
	vi.clearAllMocks();
	mockNotice.mockResolvedValue(null);
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
		await writeBrain(buildBrainAide(["kanban-index", "kanban-create"]));
		const result = await checkBrainConfig(root);
		expect(result.status).toBe("differs");
		expect(result.missingSections).toEqual(["kanban-index", "kanban-create"]);
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

	describe("migration notice", () => {
		it("reports an ok config with stale sections as differs carrying only staleSections", async () => {
			await writeBrain(buildBrainAide());
			mockNotice.mockResolvedValue({ staleSections: ["config"], legacyLauncher: null });
			const result = await checkBrainConfig(root);
			expect(result.status).toBe("differs");
			expect(result.staleSections).toEqual(["config"]);
			expect(result).not.toHaveProperty("legacyLauncher");
			expect(result).not.toHaveProperty("missingSections");
			expect(result.canonicalContent).toBeUndefined();
			expect(result.prescription).toBeUndefined();
		});

		it("reports an ok config with a legacy launcher as differs carrying only legacyLauncher", async () => {
			await writeBrain(buildBrainAide());
			mockNotice.mockResolvedValue({ staleSections: [], legacyLauncher: ["unpinned", "missing-auto-confirm"] });
			const result = await checkBrainConfig(root);
			expect(result.status).toBe("differs");
			expect(result.legacyLauncher).toEqual(["unpinned", "missing-auto-confirm"]);
			expect(result).not.toHaveProperty("staleSections");
			expect(result).not.toHaveProperty("missingSections");
			expect(result.canonicalContent).toBeUndefined();
			expect(result.prescription).toBeUndefined();
		});

		it("reports missing, stale and legacy drift each under its own field", async () => {
			await writeBrain(buildBrainAide(["kanban-index"]));
			mockNotice.mockResolvedValue({ staleSections: ["orientation", "config"], legacyLauncher: ["unpinned"] });
			const result = await checkBrainConfig(root);
			expect(result.status).toBe("differs");
			expect(result.missingSections).toEqual(["kanban-index"]);
			expect(result.staleSections).toEqual(["orientation", "config"]);
			expect(result.legacyLauncher).toEqual(["unpinned"]);
			expect(result.canonicalContent).toBeUndefined();
			expect(result.prescription).toBeUndefined();
		});

		it("does not consult the notice for an absent file", async () => {
			await checkBrainConfig(root);
			expect(mockNotice).not.toHaveBeenCalled();
		});

		it("does not consult the notice for a malformed file", async () => {
			await writeBrain("no frontmatter here\n");
			await checkBrainConfig(root);
			expect(mockNotice).not.toHaveBeenCalled();
		});
	});
});
