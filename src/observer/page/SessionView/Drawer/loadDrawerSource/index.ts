import fetchFile from "@/observer/page/api/fetchFile/index.js";
import fetchTask from "@/observer/page/api/fetchTask/index.js";
import type { ApiResult, DrawerFetchPlan, DrawerFileRole, DrawerSource } from "@/observer/page/types/index.js";

/**
 * Runs a drawer's fetch plan through the JSON API: every file of a module in parallel, or the one
 * task. The first failure (in plan order) is the result, with the observer's own message; nothing
 * partial is returned. A plan that needs nothing answers at once with an empty source.
 */
export default async function loadDrawerSource({
	plan,
	token,
	projectKey,
}: {
	plan: DrawerFetchPlan;
	token: string;
	projectKey: string;
}): Promise<ApiResult<DrawerSource>> {
	if (plan.type === "none") return { ok: true, data: { type: "none" } };

	if (plan.type === "task") {
		const task = await fetchTask({ token, projectKey, slug: plan.slug });
		return task.ok ? { ok: true, data: { type: "task", note: task.data } } : task;
	}

	const reads = await Promise.all(plan.files.map(({ path }) => fetchFile({ token, projectKey, path })));
	const texts: Partial<Record<DrawerFileRole, string>> = {};
	for (const [index, read] of reads.entries()) {
		if (!read.ok) return read;
		texts[plan.files[index]!.role] = read.data.text;
	}
	return { ok: true, data: { type: "files", texts } };
}
