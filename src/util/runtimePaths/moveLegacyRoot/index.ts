import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { FileMove, LegacyMove } from "../types/index.js";
import describeError from "../../describeError/index.js";
import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import listProjectFolders from "../listProjectFolders/index.js";
import {
	ARCHIVE_FOLDER,
	ENDED_FOLDER,
	EVENTS_FOLDER,
	LOG_EXTENSION,
	OBSERVER_RECORD_FILE,
	OBSERVER_TOKEN_FILE,
	PRESENCE_FOLDER,
	RECORD_EXTENSION,
} from "../shared/runtimeNames/index.js";
import resolveLegacyRoot from "./resolveLegacyRoot/index.js";
import moveLog from "./moveLog/index.js";
import moveRecord from "./moveRecord/index.js";
import removeEmptyFolders from "./removeEmptyFolders/index.js";
import unlinkIfPresent from "./shared/unlinkIfPresent/index.js";

type Left = Extract<LegacyMove, { outcome: "moved" }>["left"][number];

const KINDS = [
	{ folder: EVENTS_FOLDER, extension: LOG_EXTENSION, move: moveLog },
	{ folder: ARCHIVE_FOLDER, extension: LOG_EXTENSION, move: moveLog },
	{ folder: PRESENCE_FOLDER, extension: RECORD_EXTENSION, move: moveRecord },
	{ folder: ENDED_FOLDER, extension: RECORD_EXTENSION, move: moveRecord },
] as const;

/**
 * Carry what this process sees under the pre-fix Windows root into the current per-user root,
 * once. Runs only on Windows with `AIDEMD_HOME` unset, and does nothing when both roots are the
 * same path. Per project folder (key order), every `.jsonl` log in `events` and `archive` and
 * every `.json` record in `presence` and `ended` moves one file at a time; unknown names stay.
 * A source file is removed only after a fresh comparison shows the new root holds all of its
 * bytes. The old root's `observer.json` and `observer-token` are deleted (the new observer
 * makes its own token); every other root file stays. Emptied folders are removed, so a
 * finished move leaves nothing to find and a later call answers `none`. Only a failure to list
 * the legacy root itself throws; every file it could not move is reported in `left`.
 */
export default async function moveLegacyRoot(): Promise<LegacyMove> {
	const legacyRoot = resolveLegacyRoot();
	if (legacyRoot === null) return { outcome: "none" };

	const pathModule = pickPathModule();
	const root = resolveAppDataRoot();
	if (pathModule.resolve(legacyRoot).toLowerCase() === pathModule.resolve(root).toLowerCase()) {
		return { outcome: "none" };
	}

	let moved = 0;
	let superseded = 0;
	const left: Left[] = [];
	const tally = (path: string, result: FileMove): void => {
		if (result.outcome === "moved") moved += 1;
		else if (result.outcome === "superseded") superseded += 1;
		else left.push({ path, reason: result.reason, ...(result.detail === undefined ? {} : { detail: result.detail }) });
	};

	const projects = await listProjectFolders({ root: legacyRoot });
	for (const { projectKey } of projects) {
		for (const kind of KINDS) {
			const folder = pathModule.join(legacyRoot, projectKey, kind.folder);
			const entries: Dirent[] = await readdir(folder, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") return [];
				tally(folder, { outcome: "left", reason: "error", detail: describeError({ error }) });
				return [];
			});
			const names = entries
				.filter((entry) => entry.isFile() && entry.name.endsWith(kind.extension))
				.map((entry) => entry.name)
				.sort();
			for (const name of names) {
				const source = pathModule.join(folder, name);
				tally(source, await kind.move({ source, target: pathModule.join(root, projectKey, kind.folder, name) }));
			}
		}
	}

	for (const name of [OBSERVER_RECORD_FILE, OBSERVER_TOKEN_FILE]) {
		const file = pathModule.join(legacyRoot, name);
		await unlinkIfPresent({ file }).catch((error) =>
			tally(file, { outcome: "left", reason: "error", detail: describeError({ error }) }),
		);
	}

	await removeEmptyFolders({
		folders: [
			...projects.flatMap(({ projectKey }) => [
				...KINDS.map((kind) => pathModule.join(legacyRoot, projectKey, kind.folder)),
				pathModule.join(legacyRoot, projectKey),
			]),
			legacyRoot,
		],
	});

	if (moved === 0 && superseded === 0 && left.length === 0) return { outcome: "none" };
	return { outcome: "moved", legacyRoot, moved, superseded, left };
}
