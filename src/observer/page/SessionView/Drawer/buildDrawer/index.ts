import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { DrawerContext, DrawerItem, DrawerModel, DrawerSource, ModuleFiles } from "@/observer/page/types/index.js";
import findLinkedSlugs from "@/observer/page/SessionView/buildBoardModel/findLinkedSlugs/index.js";
import buildEventDrawer from "@/observer/page/SessionView/Drawer/buildEventDrawer/index.js";
import buildFailureDrawer from "@/observer/page/SessionView/Drawer/buildFailureDrawer/index.js";
import buildFileDrawer from "@/observer/page/SessionView/Drawer/buildFileDrawer/index.js";
import buildModuleDrawer from "@/observer/page/SessionView/Drawer/buildModuleDrawer/index.js";
import buildTaskDrawer from "@/observer/page/SessionView/Drawer/buildTaskDrawer/index.js";
import classifyFile from "@/observer/page/SessionView/Drawer/classifyFile/index.js";
import findSessionStart from "@/observer/page/SessionView/Drawer/findSessionStart/index.js";

/** The module files a source holds; a role it does not hold is null. */
function pickModuleFiles({ source }: { source: DrawerSource }): ModuleFiles {
	const texts = source.type === "files" ? source.texts : {};
	return { spec: texts.spec ?? null, plan: texts.plan ?? null, todo: texts.todo ?? null, brief: texts.brief ?? null, research: texts.research ?? null, session: texts.session ?? null };
}

/**
 * Builds an item's drawer from what was fetched for it (`planDrawerFetch` says what that is): a
 * module or an AIDE file as its module's drawer (the opened file's blocks first), any other file as
 * plain text, a task from its note, an event from the held events. An event the page does not hold,
 * or one the history never opens, is the failure drawer, with a message saying so.
 */
export default function buildDrawer({ item, source, context }: { item: DrawerItem; source: DrawerSource; context: DrawerContext }): DrawerModel {
	switch (item.kind) {
		case "module":
			return buildModuleDrawer({ folder: item.folder, firstKind: null, files: pickModuleFiles({ source }), context });
		case "file": {
			const classified = classifyFile(item.path);
			if (classified !== null) {
				return buildModuleDrawer({ folder: classified.folder, firstKind: classified.kind, files: pickModuleFiles({ source }), context });
			}
			return buildFileDrawer({ path: item.path, text: source.type === "files" ? (source.texts.file ?? "") : "" });
		}
		case "task": {
			if (source.type !== "task") return buildFailureDrawer({ item, message: "This task could not be read.", context });
			const linked = source.note.task.inSession || findLinkedSlugs({ events: context.events, focus: context.focus }).has(source.note.slug);
			const started = findSessionStart({ sessionId: context.focus, sessions: context.sessions, events: context.events });
			return buildTaskDrawer({
				task: source.note,
				linked,
				sessionStart: started === null ? null : formatClock({ iso: started, now: context.now }).start,
			});
		}
		case "event": {
			const event = context.events.find((candidate) => candidate.sessionId === item.sessionId && candidate.seq === item.seq);
			const drawer =
				event === undefined
					? null
					: buildEventDrawer({ event, context, todoText: source.type === "files" ? (source.texts.todo ?? null) : null });
			return drawer ?? buildFailureDrawer({ item, message: "This event is no longer held by the viewer.", context });
		}
	}
}
