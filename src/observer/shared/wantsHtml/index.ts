/**
 * Whether an Accept header lists the media type text/html: comma-separated entries, parameters
 * after `;` ignored, case-insensitive. Browsers send it; the single-instance probe and API callers
 * do not, so `GET /` can answer the page to one and the JSON to the other.
 */
export default function wantsHtml({ accept }: { accept: string | undefined }): boolean {
	if (!accept) return false;
	return accept.split(",").some((entry) => entry.split(";")[0].trim().toLowerCase() === "text/html");
}
