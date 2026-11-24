import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerContext, ModuleRow } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/**
 * The module drawer's meta line: the spec's alignment, `plan <status> <done>/<total>` and
 * `working now` while the followed session has a phase running on the module, each only when the
 * observer reported it (null when none is).
 */
export default function describeModule({ folder, row, context }: { folder: string; row: ModuleRow | null; context: DrawerContext }): string | null {
	const projectRoot = context.status?.projectRoot ?? "";
	const working = (context.status?.running ?? []).some(
		(work) => work.sessionId === context.focus && normalizeModule({ projectRoot, module: work.module }) === folder,
	);
	const plan = row?.plan ?? null;
	return joinMeta([
		row?.alignment,
		plan === null ? null : `plan ${plan.status === "unset" ? "" : `${plan.status} `}${plan.done}/${plan.total}`,
		working ? "working now" : null,
	]);
}
