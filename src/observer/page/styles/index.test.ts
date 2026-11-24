import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = __dirname;
const designCss = path.resolve(
	stylesDir,
	"../../../../design/aide-viewer-handoff/design_reference/viewer.css",
);

const listFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? listFiles(full) : [full];
	});

const cssFiles = (): string[] => listFiles(stylesDir).filter((file) => file.endsWith(".css"));

describe("observer page styles", () => {
	it("copies the design handoff's viewer.css byte for byte", () => {
		const copy = readFileSync(path.join(stylesDir, "viewer/index.css"));
		const source = readFileSync(designCss);
		expect(copy.equals(source)).toBe(true);
	});

	it("loads only data: or @fontsource woff2 targets through url()", () => {
		const files = cssFiles();
		expect(files.length).toBeGreaterThanOrEqual(4);
		for (const file of files) {
			const text = readFileSync(file, "utf8");
			for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+)\1/g)) {
				const target = match[2]!;
				const allowed = target.startsWith("data:") || /^@fontsource\/[^"']+\.woff2$/.test(target);
				expect(allowed, `${file}: ${target.slice(0, 60)}`).toBe(true);
			}
		}
	});

	it("imports only the three local style files, in order", () => {
		const text = readFileSync(path.join(stylesDir, "index.css"), "utf8");
		const imports = [...text.matchAll(/@import\s+"([^"]+)"/g)].map((match) => match[1]);
		expect(imports).toEqual(["./fonts/index.css", "./viewer/index.css", "./additions/index.css"]);
		for (const file of cssFiles().filter((css) => css !== path.join(stylesDir, "index.css"))) {
			expect(readFileSync(file, "utf8")).not.toContain("@import");
		}
	});

	it("declares every Inter and JetBrains Mono weight in both subsets, with no remote source", () => {
		const text = readFileSync(path.join(stylesDir, "fonts/index.css"), "utf8");
		const families: [string, string, number[]][] = [
			["inter", "Inter", [400, 500, 600, 700, 800]],
			["jetbrains-mono", "JetBrains Mono", [400, 500, 600, 700]],
		];
		for (const [slug, family, weights] of families) {
			expect(text).toContain(`font-family:'${family}'`);
			for (const weight of weights) {
				for (const subset of ["latin", "latin-ext"]) {
					expect(text).toContain(
						`@fontsource/${slug}/files/${slug}-${subset}-${weight}-normal.woff2`,
					);
				}
			}
		}
		expect(text).not.toContain(".woff\"");
		expect(text).not.toMatch(/https?:/);
	});

	it("scopes every additions rule other than body under .av or .av.phone", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8");
		const rules = text
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.split("}")
			.map((rule) => rule.trim())
			.filter((rule) => rule.length > 0)
			.map((rule) => rule.split("{")[0]!.trim());
		expect(rules).toContain("body");
		for (const selector of rules.filter((rule) => rule !== "body")) {
			expect(selector.startsWith(".av ") || selector.startsWith(".av.phone ")).toBe(true);
		}
	});

	it("lifts phone touch targets only under .av.phone, to 44px", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const phoneRules = text.split("}").filter((rule) => rule.includes(".av.phone "));
		const targets = [".tw", ".av-linkbtn", ".av-seg button", ".av-switch button", ".av-filters button", ".av-outline a", ".av-field", ".av-hrow"];
		for (const target of targets) {
			const rule = phoneRules.find((candidate) => candidate.split("{")[0]!.includes(target));
			expect(rule, target).toBeDefined();
			expect(rule).toMatch(/(min-)?height:44px/);
		}
		expect(text.split("}").filter((rule) => rule.includes("44px") && !rule.includes(".av.phone "))).toEqual([]);
	});
});
