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

	it("scopes every additions rule other than body to the viewer root: .av, .av.phone or .av.desk descendants, or .av and its descendants together", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8");
		const rules = text
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.split("}")
			.map((rule) => rule.trim())
			.filter((rule) => rule.length > 0)
			.map((rule) => rule.split("{")[0]!.trim());
		expect(rules).toContain("body");
		const scoped = /^(\.av |\.av\.phone |\.av\.desk[ :]|\.av\.desk$)/;
		for (const selector of rules.filter((rule) => rule !== "body")) {
			for (const part of selector.split(/,(?![^(]*\))/).map((candidate) => candidate.trim())) {
				expect(scoped.test(part) || part === ".av" || part === ".av *", part).toBe(true);
			}
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
		const elsewhere = text
			.split("}")
			.filter((rule) => rule.includes("44px") && !rule.includes(".av.phone "))
			.map((rule) => rule.split("{")[0]!.trim());
		expect(elsewhere).toEqual([".av .av-histbar", ".av .av-histbar-row", ".av .av-launch"]);
	});

	it("shows a skipped cell's meta and a skipped lane in the rail bar", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const rules = text
			.split("}")
			.map((rule) => rule.split("{") as [string, string?])
			.filter(([, body]) => body !== undefined)
			.map(([selector, body]) => ({ selectors: selector.split(/,(?![^(]*\))/).map((part) => part.trim()), body: body! }));
		const metaRules = rules.filter((rule) => rule.selectors.includes(".av .av-rail-wrap .av-ph.skip .p-meta"));
		expect(metaRules.length).toBeGreaterThan(0);
		for (const rule of metaRules) expect(rule.body).not.toContain("display:none");
		expect(metaRules.some((rule) => /display:(inline|inline-block)/.test(rule.body))).toBe(true);
		for (const rule of rules.filter((candidate) => /display:none/.test(candidate.body))) {
			for (const selector of rule.selectors.filter((part) => part.includes(".av-lane.todo"))) {
				expect(selector, selector).toContain(":not(.skip)");
			}
		}
		const empty = rules.find((rule) => rule.selectors.some((part) => part.startsWith(".av .av-rail-wrap .av-lanes:not(:has(")));
		expect(empty?.selectors.join(",")).toContain(".av-lane.skip");
	});

	it("reserves the rail bar's 52px only when the rail is drawn", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const rules = text
			.split("}")
			.map((rule) => rule.split("{") as [string, string?])
			.filter(([, body]) => body !== undefined)
			.map(([selector, body]) => ({ selector: selector.trim(), body: body! }));
		const noRail = rules.find((rule) => rule.selector === ".av .av-body:has(.av-main):not(:has(.av-rail-wrap))");
		expect(noRail?.body).toContain("padding-bottom:0");
		const frame = rules.find((rule) => rule.selector === ".av.desk:has(.av-main) .av-body");
		expect(frame).toBeDefined();
		expect(frame?.body).not.toContain("padding-bottom");
		expect(rules.find((rule) => rule.selector === ".av .av-rail-wrap")?.body).toContain("height:52px");
		expect(rules.find((rule) => rule.selector === ".av .av-body")?.body).toContain("padding-bottom:52px");
	});

	it("hides the rail footer on a phone only", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const rules = text
			.split("}")
			.map((rule) => rule.split("{") as [string, string?])
			.filter(([, body]) => body !== undefined)
			.map(([selector, body]) => ({ selectors: selector.split(/,(?![^(]*\))/).map((part) => part.trim()), body: body! }));
		const phone = rules.find((rule) => rule.selectors.includes(".av.phone .av-rail-foot"));
		expect(phone?.body).toContain("display:none");
		const hiding = rules.filter(
			(rule) => rule.selectors.some((part) => part.includes(".av-rail-foot")) && /display:none/.test(rule.body),
		);
		for (const rule of hiding) {
			for (const selector of rule.selectors.filter((part) => part.includes(".av-rail-foot"))) {
				expect(selector, selector).toContain(".av.phone");
			}
		}
	});

	it("keeps the waiting banner sticky, one line and no taller than 64px, with no motion", () => {
		const text = readFileSync(path.join(stylesDir, "additions/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const rules = text
			.split("}")
			.map((rule) => rule.split("{") as [string, string?])
			.filter(([, body]) => body !== undefined)
			.map(([selector, body]) => ({ selector: selector.trim(), body: body! }));
		const banner = rules.find((rule) => rule.selector === ".av .av-wait-banner");
		expect(banner?.body).toContain("position:sticky");
		expect(banner?.body).toContain("white-space:nowrap");
		expect(banner?.body).toContain("flex-wrap:nowrap");
		expect(Number(/(?:^|;)height:(\d+)px/.exec(banner!.body)?.[1])).toBeLessThanOrEqual(64);
		const what = rules.find((rule) => rule.selector === ".av .av-wait-banner .w-what");
		expect(what?.body).toContain("text-overflow:ellipsis");
		const phone = rules.find((rule) => rule.selector.startsWith(".av.phone .av-wait-banner .w-what"));
		expect(phone?.body).toContain("display:none");
		for (const rule of rules.filter((candidate) => /av-wait-banner|av-top/.test(candidate.selector))) {
			expect(rule.body, rule.selector).not.toMatch(/animation|transition/);
		}
	});
});
