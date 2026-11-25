/** The per-user runtime locations for one project. Never inside the project itself. */
export type RuntimePaths = {
	/** The project's key: `<project folder name>-<6 hex>`, also the project's folder name under the app-data root. */
	projectKey: string;
	/** The project's runtime folder: `<app data>/aidemd/<projectKey>`. */
	folder: string;
	/** `<folder>/events`, holding one JSONL event log per session. */
	eventsFolder: string;
	/** `<folder>/presence`, holding one hook presence record per Claude session. */
	presenceFolder: string;
	/** `<folder>/ended`, holding one ended mark per observer session. */
	endedFolder: string;
};

/** The per-user locations shared by every project, at the app-data root. */
export type RootPaths = {
	/** The per-user app-data root: `<per-OS base>/aidemd`. */
	root: string;
	/** `<root>/observer.json`, the one running observer's published record. */
	observerFile: string;
};

/** One project's folder under the app-data root, found by listing the root. */
export type ProjectFolder = {
	/** The project's key, the folder's name. */
	projectKey: string;
	/** `<root>/<projectKey>/events`, holding that project's session logs. */
	eventsFolder: string;
	/** `<root>/<projectKey>/presence`, holding that project's hook presence records. */
	presenceFolder: string;
	/** `<root>/<projectKey>/ended`, holding that project's ended marks. */
	endedFolder: string;
};

/** What happened to one legacy file. `superseded`: the new root already held this file or a newer form of it, so the old copy was dropped. */
export type FileMove =
	| { outcome: "moved" }
	| { outcome: "superseded" }
	| { outcome: "left"; reason: "diverged" | "changed" | "error"; detail?: string };

/** What `moveLegacyRoot` did: nothing to move, or the counts and every file it had to leave in place (its path is the source path). */
export type LegacyMove =
	| { outcome: "none" }
	| {
			outcome: "moved";
			legacyRoot: string;
			moved: number;
			superseded: number;
			left: { path: string; reason: "diverged" | "changed" | "error"; detail?: string }[];
	  };
