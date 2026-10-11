import { describe, it, expect, vi } from "vitest";

vi.mock("@/service/buildBrainState/index.js", () => ({ default: vi.fn() }));
vi.mock("@/service/parseBrainAide/index.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/service/parseBrainAide/index.js")>();
	return { ...original, default: vi.fn() };
});

import buildBrainState from "@/service/buildBrainState/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import brainContract from "@/service/brainContract/index.js";
import launcherPurpose from "@/service/brainContract/launcherPurpose/index.js";
import { parseBundledTemplate } from "@/service/install/provisionBrain/index.js";
import readTemplateLauncher from "./readTemplateLauncher/index.js";
import readTemplateSection from "./index.js";

describe("readTemplateSection", () => {
	it.each(brainContract.map((entry) => [entry.marker, entry] as const))(
		"returns the bundled bytes and contract purpose for %s",
		(marker, entry) => {
			const result = readTemplateSection({ kind: marker });
			expect(result.template).toBe(parseBundledTemplate()[entry.field]);
			expect(result.purpose).toBe(entry.purpose);
		},
	);

	it("returns the orientation result when no kind is given", () => {
		expect(readTemplateSection({})).toEqual(readTemplateSection({ kind: "orientation" }));
	});

	it("returns the launcher bytes and launcher purpose for kind launcher", () => {
		const result = readTemplateSection({ kind: "launcher" });
		expect(result.template).toBe(readTemplateLauncher());
		expect(result.purpose).toBe(launcherPurpose);
	});

	it("returns exactly the purpose and template keys", () => {
		for (const kind of [undefined, "launcher", ...brainContract.map((entry) => entry.marker)] as const) {
			expect(Object.keys(readTemplateSection({ kind })).sort()).toEqual(["purpose", "template"]);
		}
	});

	it("returns one section only", () => {
		const orientation = parseBundledTemplate().orientation;
		expect(readTemplateSection({ kind: "config" }).template).not.toContain(orientation);
		const launcher = readTemplateSection({ kind: "launcher" }).template;
		for (const entry of brainContract) {
			expect(launcher).not.toContain(parseBundledTemplate()[entry.field]);
		}
	});

	it("never consults the host config", () => {
		readTemplateSection({});
		readTemplateSection({ kind: "launcher" });
		for (const entry of brainContract) readTemplateSection({ kind: entry.marker });
		expect(buildBrainState).not.toHaveBeenCalled();
		expect(parseBrainAide).not.toHaveBeenCalled();
	});
});
