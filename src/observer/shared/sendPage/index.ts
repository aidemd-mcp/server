import type { ServerResponse } from "node:http";
import buildPageShell from "../../buildPageShell/index.js";
import sendBody from "../sendBody/index.js";

/** The page's Content-Security-Policy (brief #53): same-origin script, style and connections, data-URI fonts and images, nothing else. */
const PAGE_CSP =
	"default-src 'none'; script-src 'self'; style-src 'self'; font-src data:; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * Answers the HTML shell with the page's strict CSP. The session route and the home
 * route (for browsers) both answer through here so the two never drift; `headers` lets the home
 * route add `Vary: Accept`.
 */
export default function sendPage({ res, headers = {} }: { res: ServerResponse; headers?: Record<string, string> }): void {
	sendBody({
		res,
		status: 200,
		contentType: "text/html; charset=utf-8",
		body: buildPageShell(),
		headers: { "Content-Security-Policy": PAGE_CSP, ...headers },
	});
}
