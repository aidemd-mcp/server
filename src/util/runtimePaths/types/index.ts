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
