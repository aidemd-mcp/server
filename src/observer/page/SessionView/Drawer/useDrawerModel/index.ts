import useFetched from "@/observer/page/shared/useFetched/index.js";
import type { DrawerContext, DrawerItem, DrawerModel, DrawerSource, Fetched } from "@/observer/page/types/index.js";
import buildDrawer from "@/observer/page/SessionView/Drawer/buildDrawer/index.js";
import buildFailureDrawer from "@/observer/page/SessionView/Drawer/buildFailureDrawer/index.js";
import loadDrawerSource from "@/observer/page/SessionView/Drawer/loadDrawerSource/index.js";
import planDrawerFetch from "@/observer/page/SessionView/Drawer/planDrawerFetch/index.js";

const NOTHING_FETCHED: DrawerSource = { type: "none" };

/**
 * Fetches what an item needs (its files read in parallel, or its task) through the JSON API and
 * builds its drawer. The texts load once per opened item and are built again on every render, so the
 * counts, alignment and `working now` stay live while the text is the one read on open. A failed
 * read is a ready drawer holding the observer's message, never an error state. Items that need
 * nothing, and events (whose verdict todo, when there is one, joins when it arrives), are ready at
 * once; the rest are `loading` until their files arrive.
 */
export default function useDrawerModel({ item, context }: { item: DrawerItem; context: DrawerContext }): Fetched<DrawerModel> {
	const plan = planDrawerFetch({ item, context });
	const fetched = useFetched<DrawerSource>({
		key: JSON.stringify(plan),
		load: plan.type === "none" ? null : () => loadDrawerSource({ plan, token: context.token, projectKey: context.projectKey }),
	});

	if (plan.type === "none") return { state: "ready", data: buildDrawer({ item, source: NOTHING_FETCHED, context }) };
	if (fetched.state === "ready") return { state: "ready", data: buildDrawer({ item, source: fetched.data, context }) };
	if (fetched.state === "error") return { state: "ready", data: buildFailureDrawer({ item, message: fetched.message, context }) };
	if (item.kind === "event") return { state: "ready", data: buildDrawer({ item, source: NOTHING_FETCHED, context }) };
	return fetched;
}
