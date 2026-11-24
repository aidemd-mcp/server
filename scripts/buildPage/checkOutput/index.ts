import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pageAssets from "@/observer/shared/pageAssets/index.js";
import fontFamilies from "../fontFamilies/index.js";
import licences from "../licences/index.js";
import declaresFontFace from "./declaresFontFace/index.js";

/**
 * Throws when the bundle in `outDir` is incomplete or reaches the network at runtime: both
 * outputs and both font licences must exist, page.css must carry an @font-face
 * for each font family, and every url() in it must be a data URI (stylesheet
 * requests carry no token).
 */
export default function checkOutput({ outDir }: { outDir: string }): void {
	const jsPath = join(outDir, pageAssets.script);
	const cssPath = join(outDir, pageAssets.stylesheet);
	const licencePaths = licences.map(({ file }) => join(outDir, file));

	for (const path of [jsPath, cssPath, ...licencePaths])
		if (!existsSync(path)) throw new Error(`buildPage: missing output ${path}`);

	const css = readFileSync(cssPath, "utf8");
	for (const family of fontFamilies)
		if (!declaresFontFace({ css, family }))
			throw new Error(`buildPage: page.css has no @font-face rule for ${family}`);

	const urls = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)];
	const external = urls.filter(([, , target]) => !target.startsWith("data:"));
	if (external.length > 0)
		throw new Error(
			`buildPage: page.css has url() targets that are not data URIs: ${external
				.map(([, , target]) => target.slice(0, 80))
				.join(", ")}`,
		);
}
