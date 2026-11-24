import pageTitle from "@/observer/shared/pageTitle/index.js";

/**
 * The browser tab's title: the shared base copy, prefixed `<project> — ` on a session view, and
 * prefixed again with `Waiting on you — ` while a gate is open so the tab says so.
 */
export default function buildDocumentTitle({ project, waiting }: { project?: string; waiting: boolean }): string {
	const base = project === undefined ? pageTitle : `${project} — ${pageTitle}`;
	return waiting ? `Waiting on you — ${base}` : base;
}
