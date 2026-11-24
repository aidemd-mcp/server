/**
 * The one definition of the page's two served assets: the names, their content types and the URL
 * folder they are served under. The shell references exactly these, the asset route serves
 * exactly these, and the build and fixture scripts check for exactly these, so none of them can
 * drift. Pair it with `locatePageAssets` for the folder on disk.
 */
const pageAssets = {
	script: "page.js",
	stylesheet: "page.css",
	urlFolder: "/assets/",
	contentTypes: {
		"page.js": "text/javascript; charset=utf-8",
		"page.css": "text/css; charset=utf-8",
	} as Record<string, string>,
} as const;

export default pageAssets;
