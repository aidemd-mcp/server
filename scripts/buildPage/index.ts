import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import locatePageAssets from "@/observer/locatePageAssets/index.js";
import pageAssets from "@/observer/shared/pageAssets/index.js";
import checkOutput from "./checkOutput/index.js";
import licences from "./licences/index.js";

/**
 * Bundles the observer page (React app, stylesheet, Inter and JetBrains Mono
 * woff2 files inlined as data URIs) into dist/observer/assets, ships both font
 * licences beside it, then fails the build if the output is incomplete or not
 * self-contained.
 */
export default async function buildPage(): Promise<void> {
	const outDir = locatePageAssets();

	await build({
		entryPoints: ["src/observer/page/index.tsx"],
		bundle: true,
		format: "esm",
		platform: "browser",
		target: "es2022",
		jsx: "automatic",
		minify: true,
		sourcemap: false,
		outfile: join(outDir, pageAssets.script),
		loader: { ".woff2": "dataurl" },
		define: { "process.env.NODE_ENV": '"production"' },
		legalComments: "linked",
		tsconfig: "tsconfig.json",
		logLevel: "warning",
	});

	for (const { source, file } of licences) copyFileSync(source, join(outDir, file));
	checkOutput({ outDir });
}

await buildPage();
