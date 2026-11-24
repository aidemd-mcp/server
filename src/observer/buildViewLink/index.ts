import buildSessionPath from "@/service/observer/event/shared/buildSessionPath/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * Builds the link the user opens: the observer's home when no view is named, otherwise that
 * project's session view, with the observer's token as the query parameter every request needs
 * (brief commitments #26, #46 as amended). The session path and the token query name come from the
 * protocol and its shared path builder, the same ones the page uses.
 */
export default function buildViewLink({
	observer,
	view,
}: {
	observer: { address: string; token: string };
	view?: { projectKey: string; sessionId: string };
}): string {
	const token = `${protocol.tokenQuery}=${encodeURIComponent(observer.token)}`;
	if (!view) return `${observer.address}/?${token}`;

	const path = buildSessionPath(view);
	return `${observer.address}${path}?${token}`;
}
