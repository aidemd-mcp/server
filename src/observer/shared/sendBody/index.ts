import type { ServerResponse } from "node:http";

/**
 * The one writer of the observer's security headers, under every answer: sendJson delegates here,
 * and the page shell and its assets call it directly. The caller's headers go last so a page can
 * replace the Content-Security-Policy. It never writes an Access-Control-* header: the observer allows no
 * cross-origin use at all.
 */
export default function sendBody({
	res,
	status,
	contentType,
	body,
	headers = {},
}: {
	res: ServerResponse;
	status: number;
	contentType: string;
	body: string | Buffer;
	headers?: Record<string, string>;
}): void {
	res.writeHead(status, {
		"Content-Type": contentType,
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "no-referrer",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
		...headers,
	});
	res.end(body);
}
