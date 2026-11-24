import type { Status } from "@/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/** The module's todo.aide checkbox counts (open of total) when the status read one, else null. */
export default function findOpenIssues({ status, module }: { status: Status; module: string }): { open: number; total: number } | null {
	const folder = normalizeModule({ projectRoot: status.projectRoot, module });
	const todo = status.workFiles.find((entry) => entry.kind === "todo" && entry.folder === folder);
	if (!todo || todo.read.state !== "present") return null;
	return { open: todo.read.progress.open, total: todo.read.progress.total };
}
