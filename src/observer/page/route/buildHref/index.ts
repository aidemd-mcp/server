import buildSessionPath from "@/service/observer/event/shared/buildSessionPath/index.js";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { HrefTarget } from "@/observer/page/types/index.js";
import formatItem from "./formatItem/index.js";

/**
 * The page's one link builder, in the path shape `src/observer/buildViewLink` hands out: Home is
 * `/?token=<t>`; a session is `/p/<key>/s/<id>?token=<t>` plus `&tab=<tab>` unless the tab is
 * `tree` and `&item=<item>` when a detail is open. Every value goes through `encodeURIComponent`.
 */
export default function buildHref(target: HrefTarget): string {
	const token = `${protocol.tokenQuery}=${encodeURIComponent(target.token)}`;
	if (target.kind === "home") return `/?${token}`;

	const path = buildSessionPath(target);
	const tab = target.tab === undefined || target.tab === "tree" ? "" : `&tab=${target.tab}`;
	const item = target.item ? `&item=${encodeURIComponent(formatItem(target.item))}` : "";
	return `${path}?${token}${tab}${item}`;
}
