import pageAssets from "../shared/pageAssets/index.js";
import pageTitle from "../shared/pageTitle/index.js";

/**
 * The observer page's HTML document: a static shell holding the root element and two same-origin
 * references, the stylesheet and the module script. The shell and its assets are served without the
 * token (they hold no project data), so it takes no input and echoes none: the page reads its token
 * from its own URL. No inline script or style and no external URL, so the strict
 * Content-Security-Policy of the page routes needs no relaxation.
 */
export default function buildPageShell(): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		'<meta name="theme-color" content="#0D1117">',
		'<meta name="referrer" content="no-referrer">',
		`<title>${pageTitle}</title>`,
		'<link rel="icon" href="data:,">',
		`<link rel="stylesheet" href="${pageAssets.urlFolder}${pageAssets.stylesheet}">`,
		`<script type="module" src="${pageAssets.urlFolder}${pageAssets.script}"></script>`,
		"</head>",
		"<body>",
		'<div id="root"></div>',
		"</body>",
		"</html>",
		"",
	].join("\n");
}
