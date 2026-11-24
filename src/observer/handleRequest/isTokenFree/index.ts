import type routeTable from "../../shared/routeTable/index.js";
import wantsHtml from "../../shared/wantsHtml/index.js";

/**
 * Whether a matched route answers without the observer's token: `open` routes always do (the page
 * shell and the allowlisted assets), `open-for-html` routes only when the request's Accept lists
 * text/html (the home page, not the JSON probe), and every other route needs the token. The guard
 * still checks Host and Origin either way.
 */
export default function isTokenFree({
	tokenAccess,
	accept,
}: {
	tokenAccess: (typeof routeTable)[number]["tokenAccess"];
	accept: string | undefined;
}): boolean {
	if (tokenAccess === "open") return true;
	return tokenAccess === "open-for-html" && wantsHtml({ accept });
}
