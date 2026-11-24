import type { WaitingFile } from "@/types/index.js";
import buildHref from "@/observer/page/route/buildHref/index.js";
import baseName from "@/util/baseName/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { WaitCardModel } from "@/observer/page/types/index.js";
import moduleLabel from "@/observer/page/HomeView/buildHomeModel/moduleLabel/index.js";

/**
 * One amber wait card from one open waiting file: the file's base name, its module, how long it has
 * waited (`6m`) and since when (`14:28`), and the link that opens its session with that file's detail.
 */
export default function buildWaitCard({
	token,
	project,
	waiting,
	now,
}: {
	token: string;
	project: { projectKey: string; name: string };
	waiting: WaitingFile;
	now: Date;
}): WaitCardModel {
	return {
		key: `${project.projectKey}:${waiting.sessionId}:${waiting.seq}`,
		project: project.name,
		file: baseName(waiting.file),
		module: moduleLabel({ folder: waiting.folder, projectName: project.name }),
		since: formatAgo({ iso: waiting.since, now }),
		at: formatClock({ iso: waiting.since, now }).clock,
		href: buildHref({
			kind: "session",
			token,
			projectKey: project.projectKey,
			sessionId: waiting.sessionId,
			item: { kind: "file", path: waiting.file },
		}),
	};
}
