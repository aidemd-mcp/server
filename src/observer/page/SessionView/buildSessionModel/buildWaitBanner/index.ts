import type { Status } from "@/types/index.js";
import moduleLabel from "@/observer/page/HomeView/buildHomeModel/moduleLabel/index.js";
import baseName from "@/util/baseName/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import type { WaitBannerModel } from "@/observer/page/types/index.js";

/**
 * The amber banner's words from the open gate the now card shows (the followed session's, else the
 * project's newest): the file's base name, its module (the root reads as the project's name) and how
 * long it has waited. Null while nothing awaits approval, or with no status to read gates from.
 */
export default function buildWaitBanner({
	status,
	focus,
	name,
	now,
}: {
	status: Status | null;
	focus: string;
	name: string;
	now: Date;
}): WaitBannerModel | null {
	const waiting = status?.waiting.find((file) => file.sessionId === focus) ?? status?.waiting[0];
	if (waiting === undefined) return null;
	return {
		file: baseName(waiting.file),
		module: moduleLabel({ folder: waiting.folder, projectName: name }),
		since: formatAgo({ iso: waiting.since, now }),
	};
}
