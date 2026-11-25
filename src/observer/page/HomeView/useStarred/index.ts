import { useState } from "react";

/** Where the viewer's starred projects are kept in this browser. */
const STORAGE_KEY = "aide-viewer:starred-projects";

/** The stored starred keys; empty when storage is unavailable or holds nothing valid. */
function readStored(): Set<string> {
	try {
		const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
		return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
	} catch {
		return new Set();
	}
}

/**
 * The projects the viewer starred (project keys), remembered in this browser. Starred projects get
 * their own section at the top of Home; `setStarred` stars or unstars one.
 */
export default function useStarred(): { starred: ReadonlySet<string>; setStarred(projectKey: string, on: boolean): void } {
	const [starred, setState] = useState<ReadonlySet<string>>(readStored);
	const setStarred = (projectKey: string, on: boolean): void => {
		const next = new Set(starred);
		if (on) next.add(projectKey);
		else next.delete(projectKey);
		setState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
		} catch {
			// storage blocked: the stars last for this page only
		}
	};
	return { starred, setStarred };
}
