import sendPage from "../../shared/sendPage/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /p/:project/s/:session — the target of the session link the tools hand out: the
 * HTML shell of the observer page, with the page's strict Content-Security-Policy, served without the token. It reads
 * nothing from the store or the disk and answers during the replay; the page reads its project and
 * session from the URL and shows an unknown project as not found itself.
 */
export default async function getSessionPage({ res }: RouteInput): Promise<void> {
	sendPage({ res });
}
